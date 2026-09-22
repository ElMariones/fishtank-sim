import type { AbsenceSummary } from '../core/absence';
import { createRuntime, importRuntime, type Runtime } from '../core/runtime';
import { SAVE_KEY } from '../core/save';
import { createWorld } from '../core/world';
import { commitSnapshot, openDatabase, readSlots, type SaveRecord } from './database';
import { acquireWriterLease, type WriterLease } from './writerLease';

export class SaveSession {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(readonly database: IDBDatabase, private token: number | null, readonly lease: WriterLease) {}
  save(runtime: Runtime, replaceUnreadable = false): Promise<SaveRecord> {
    if (!this.lease.writable) return Promise.reject(new Error('Another tab currently controls this world.'));
    const job = this.queue.then(async () => {
      const record = await commitSnapshot(this.database, runtime, this.token, replaceUnreadable);
      this.token = record.token;
      return record;
    });
    this.queue = job.catch(() => {});
    return job;
  }
  async close() { await this.queue; this.database.close(); this.lease.release(); }
}

export type LoadedSession = {
  runtime: Runtime; session: SaveSession | null; blocked: boolean; readOnly: boolean; warning: string; resumeNotice: string;
  /** A calendar report supplied by an active session; loading never advances time, so this starts null. */
  absence: AbsenceSummary | null;
};
export async function loadSession(): Promise<LoadedSession> {
  const worldId = crypto.randomUUID();
  let session: SaveSession | null = null;
  let lease: WriterLease | null = null;
  let fallback = createRuntime(createWorld(new Date().toISOString()), worldId);
  try {
    lease = await acquireWriterLease();
    const database = await openDatabase();
    const slots = await readSlots(database);
    session = new SaveSession(database, slots.current?.token ?? null, lease);
    if (slots.current) {
      const stored = importRuntime(slots.current.raw, worldId);
      // The calendar is player-controlled. Wall-clock absence must never age animals or expire shows.
      return { runtime: stored, session, blocked: false, readOnly: !lease.writable,
        warning: lease.writable ? '' : 'Read-only: another tab controls this world. Close it, then reload this tab to continue.',
        resumeNotice: 'Your calendar is exactly where you left it. Use Day, Week or Month to advance.', absence: null };
    }
    if (slots.backup1 || slots.backup2) throw new Error('The current snapshot is missing. Review a recovery copy before saving.');
    const legacy = localStorage.getItem(SAVE_KEY);
    if (legacy !== null) fallback = importRuntime(legacy, worldId);
    await session.save(fallback);
    // Keep the original v1 localStorage data intact even after successful migration/read-back.
    return { runtime: fallback, session, blocked: false, readOnly: false, warning: '', resumeNotice: '', absence: null };
  } catch (error) {
    if (!session) lease?.release();
    return { runtime: fallback, session, blocked: true, readOnly: false, resumeNotice: '', absence: null,
      warning: `Stored data has been preserved. This session will not autosave. ${error instanceof Error ? error.message : 'Storage is unavailable.'} Open Saves to export or recover.` };
  }
}
