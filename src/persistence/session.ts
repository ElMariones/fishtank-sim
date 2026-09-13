import { applyOfflineCatchup, createRuntime, importRuntime, type Runtime } from '../core/runtime';
import { SAVE_KEY } from '../core/save';
import { createWorld } from '../core/world';
import { commitSnapshot, openDatabase, readSlots, type SaveRecord } from './database';
import { acquireWriterLease, type WriterLease } from './writerLease';
import { TICK_MS } from '../simulation/time';

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

/** Whole hours stay exact ("8 hours"); shorter gaps read as minutes or seconds. */
function formatDuration(seconds: number) {
  const [value, unit]: [string, string] = seconds >= 3600 ? [(seconds / 3600).toFixed(seconds % 3600 ? 1 : 0), 'hour']
    : seconds >= 60 ? [String(Math.round(seconds / 60)), 'minute'] : [String(seconds), 'second'];
  return `${value} ${unit}${value === '1' ? '' : 's'}`;
}

export type LoadedSession = {
  runtime: Runtime; session: SaveSession | null; blocked: boolean; readOnly: boolean; warning: string; resumeNotice: string;
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
      const caughtUp = lease.writable ? applyOfflineCatchup(stored, Date.parse(slots.current.savedAt), Date.now()) : { runtime: stored, window: null };
      const seconds = caughtUp.window ? Math.round(caughtUp.window.appliedTicks * TICK_MS / 1000) : 0;
      const resumeNotice = seconds
        ? `${formatDuration(seconds)} of protected research time restored${caughtUp.window?.remainingTicks ? '; the eight-hour offline cap was reached' : ''}. Life-history effects are inactive in this lab.`
        : '';
      return { runtime: caughtUp.runtime, session, blocked: false, readOnly: !lease.writable,
        warning: lease.writable ? '' : 'Read-only: another tab controls this world. Close it, then reload this tab to continue.', resumeNotice };
    }
    if (slots.backup1 || slots.backup2) throw new Error('The current snapshot is missing. Review a recovery copy before saving.');
    const legacy = localStorage.getItem(SAVE_KEY);
    if (legacy !== null) fallback = importRuntime(legacy, worldId);
    await session.save(fallback);
    // Keep the original v1 localStorage data intact even after successful migration/read-back.
    return { runtime: fallback, session, blocked: false, readOnly: false, warning: '', resumeNotice: '' };
  } catch (error) {
    if (!session) lease?.release();
    return { runtime: fallback, session, blocked: true, readOnly: false, resumeNotice: '',
      warning: `Stored data has been preserved. This session will not autosave. ${error instanceof Error ? error.message : 'Storage is unavailable.'} Open Saves to export or recover.` };
  }
}
