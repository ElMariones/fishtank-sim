export type WriterLease = { writable: boolean; supported: boolean; release: () => void };

/** Hold a browser-wide exclusive writer lock until release. Compare-and-swap remains the fallback safeguard. */
export async function acquireWriterLease(name = 'fishtank-sim-writer'): Promise<WriterLease> {
  if (!navigator.locks) return { writable: true, supported: false, release: () => {} };
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  type Outcome = 'held' | 'unavailable' | 'failed';
  let resolveAcquired!: (value: Outcome) => void;
  const acquired = new Promise<Outcome>(resolve => { resolveAcquired = resolve; });
  let reported = false;
  const report = (value: Outcome) => { if (!reported) { reported = true; resolveAcquired(value); } };
  const request = navigator.locks.request(name, { ifAvailable: true }, async lock => {
    report(lock ? 'held' : 'unavailable');
    if (lock) await held;
  });
  void request.catch(() => report('failed'));
  const outcome = await acquired;
  const writable = outcome !== 'unavailable';
  let closed = false;
  return {
    writable,
    supported: outcome !== 'failed',
    release: () => {
      if (closed) return;
      closed = true;
      release();
      void request.catch(() => {});
    },
  };
}
