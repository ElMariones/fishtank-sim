import { createRuntime, importRuntime, type Runtime } from '../core/runtime';
import { SAVE_KEY } from '../core/save';
import { createWorld } from '../core/world';
import { commitSnapshot, openDatabase, readSlots, type SaveRecord } from './database';

export class SaveSession {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(readonly database: IDBDatabase, private token: number | null) {}
  save(runtime: Runtime, replaceUnreadable = false): Promise<SaveRecord> {
    const job = this.queue.then(async () => {
      const record = await commitSnapshot(this.database, runtime, this.token, replaceUnreadable);
      this.token = record.token;
      return record;
    });
    this.queue = job.catch(() => {});
    return job;
  }
  async close() { await this.queue; this.database.close(); }
}

export type LoadedSession = { runtime: Runtime; session: SaveSession | null; blocked: boolean; warning: string };
export async function loadSession(): Promise<LoadedSession> {
  const worldId = crypto.randomUUID();
  let session: SaveSession | null = null;
  let fallback = createRuntime(createWorld(new Date().toISOString()), worldId);
  try {
    const database = await openDatabase();
    const slots = await readSlots(database);
    session = new SaveSession(database, slots.current?.token ?? null);
    if (slots.current) return { runtime: importRuntime(slots.current.raw, worldId), session, blocked: false, warning: '' };
    if (slots.backup1 || slots.backup2) throw new Error('The current snapshot is missing. Review a recovery copy before saving.');
    const legacy = localStorage.getItem(SAVE_KEY);
    if (legacy !== null) fallback = importRuntime(legacy, worldId);
    await session.save(fallback);
    // Keep the original v1 localStorage data intact even after successful migration/read-back.
    return { runtime: fallback, session, blocked: false, warning: '' };
  } catch (error) {
    return { runtime: fallback, session, blocked: true,
      warning: `Stored data has been preserved. This session will not autosave. ${error instanceof Error ? error.message : 'Storage is unavailable.'} Open Saves to export or recover.` };
  }
}
