export const TICK_MS = 50;
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
export const MAX_INTEGRATION_STEP_TICKS = 20 * 60;
/** Idle clock checkpoint cadence. Commands still save at once; reload catch-up covers any gap after the last save. */
export const ACTIVE_CHECKPOINT_MS = 5 * 60 * 1000;

export type TimeSegment = { fromTick: number; toTick: number; boundary: boolean };

/** Split deterministic integration at scheduled events and bounded work intervals. */
export function timelineSegments(
  fromTick: number,
  toTick: number,
  eventTicks: readonly number[] = [],
  maxStep = MAX_INTEGRATION_STEP_TICKS,
): TimeSegment[] {
  if (!Number.isSafeInteger(fromTick) || !Number.isSafeInteger(toTick) || fromTick < 0 || toTick < fromTick)
    throw new Error('Invalid simulation tick range.');
  if (!Number.isSafeInteger(maxStep) || maxStep < 1) throw new Error('Integration step must be a positive integer.');
  const boundaries = new Set(eventTicks.filter(tick => Number.isSafeInteger(tick) && tick > fromTick && tick <= toTick));
  const segments: TimeSegment[] = [];
  let cursor = fromTick;
  while (cursor < toTick) {
    const nextBoundary = [...boundaries].filter(tick => tick > cursor).reduce((nearest, tick) => Math.min(nearest, tick), Infinity);
    const to = Math.min(toTick, cursor + maxStep, nextBoundary);
    segments.push({ fromTick: cursor, toTick: to, boundary: boundaries.has(to) });
    cursor = to;
  }
  return segments;
}

export type OfflineWindow = {
  requestedTicks: number;
  appliedTicks: number;
  remainingTicks: number;
  clockWentBackwards: boolean;
};

/** Offline time always runs at normal 1x speed and is protected by the eight-hour cap. */
export function offlineWindow(savedAtMs: number, nowMs: number): OfflineWindow {
  if (!Number.isFinite(savedAtMs) || !Number.isFinite(nowMs)) throw new Error('Invalid real-time boundary.');
  const elapsed = Math.max(0, Math.floor(nowMs - savedAtMs));
  const requestedTicks = Math.floor(elapsed / TICK_MS);
  const appliedTicks = Math.floor(Math.min(elapsed, OFFLINE_CAP_MS) / TICK_MS);
  return { requestedTicks, appliedTicks, remainingTicks: requestedTicks - appliedTicks, clockWentBackwards: nowMs < savedAtMs };
}
