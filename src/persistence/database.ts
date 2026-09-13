import { decodeRuntime, type Runtime } from '../core/runtime';

export const DATABASE_NAME = 'fishtank-sim';
export type SaveRecord = { raw: string; token: number; savedAt: string };
export type SaveSlots = { current: SaveRecord | null; backup1: SaveRecord | null; backup2: SaveRecord | null };
const request = <T>(operation: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  operation.onsuccess = () => resolve(operation.result);
  operation.onerror = () => reject(operation.error ?? new Error('Database request failed.'));
});
const completed = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onabort = () => reject(transaction.error ?? new Error('Save transaction was interrupted.'));
  transaction.onerror = () => { /* onabort reports the final transaction outcome. */ };
});

export async function openDatabase(name = DATABASE_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(name, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore('snapshots');
    opening.onerror = () => reject(opening.error ?? new Error('Cannot open browser storage.'));
    opening.onblocked = () => reject(new Error('Close older aquarium tabs, then reload to open storage.'));
    opening.onsuccess = () => {
      const database = opening.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
  });
}

export async function readSlots(database: IDBDatabase): Promise<SaveSlots> {
  const transaction = database.transaction('snapshots', 'readonly'), done = completed(transaction);
  const store = transaction.objectStore('snapshots');
  const [current, backup1, backup2] = await Promise.all(['current', 'backup1', 'backup2'].map(key => request<SaveRecord | undefined>(store.get(key))));
  await done;
  return { current: current ?? null, backup1: backup1 ?? null, backup2: backup2 ?? null };
}

/** Validation precedes the write transaction. Rotation and current commit succeed or abort together.
 * Compare-and-swap stops a stale tab from replacing a newer snapshot. It is not a UI writer lease.
 */
export async function commitSnapshot(database: IDBDatabase, runtime: Runtime, expectedToken: number | null, replaceUnreadable = false): Promise<SaveRecord> {
  const raw = JSON.stringify(runtime);
  decodeRuntime(raw);
  const transaction = database.transaction('snapshots', 'readwrite'), done = completed(transaction);
  const store = transaction.objectStore('snapshots');
  try {
    const current = await request<SaveRecord | undefined>(store.get('current'));
    if ((current?.token ?? null) !== expectedToken) throw new Error('Another tab saved a newer world. Export this session, then reload.');
    if (current?.raw === raw) { await done; return current; }
    let validCurrent = false;
    if (current) {
      try { decodeRuntime(current.raw); validCurrent = true; }
      catch { if (!replaceUnreadable) throw new Error('The existing save is unreadable and has been preserved. Choose recovery explicitly.'); }
    }
    const backup = await request<SaveRecord | undefined>(store.get('backup1'));
    if (validCurrent) {
      if (backup) {
        try { decodeRuntime(backup.raw); store.put(backup, 'backup2'); }
        catch { store.put(backup, `preserved-backup-${current!.token}`); }
      }
      store.put(current, 'backup1');
    } else if (current) store.put(current, `preserved-${current.token}`);
    const record: SaveRecord = { raw, token: (expectedToken ?? 0) + 1, savedAt: new Date().toISOString() };
    store.put(record, 'current');
    // Read-back within the same transaction, so a failed verification aborts the rotation as well.
    const readBack = await request<SaveRecord>(store.get('current'));
    if (readBack.raw !== raw || readBack.token !== record.token) throw new Error('Save read-back did not match.');
    await done;
    return record;
  } catch (error) {
    try { transaction.abort(); } catch { /* May already have aborted on quota failure. */ }
    await done.catch(() => {});
    throw error;
  }
}
