import { beforeEach, describe, expect, it, vi } from 'vitest';
import { advanceRuntime, createRuntime } from '../src/core/runtime';
import { createWorld } from '../src/core/world';
import { TICKS_PER_GAME_DAY } from '../src/core/water';

const mocks = vi.hoisted(() => ({ readSlots: vi.fn(), commitSnapshot: vi.fn(), acquireWriterLease: vi.fn() }));
vi.mock('../src/persistence/database', () => ({ openDatabase: vi.fn(async () => ({ close: vi.fn() })), readSlots: mocks.readSlots, commitSnapshot: mocks.commitSnapshot }));
vi.mock('../src/persistence/writerLease', () => ({ acquireWriterLease: mocks.acquireWriterLease }));
import { loadSession } from '../src/persistence/session';

describe('Player-controlled calendar persistence', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.acquireWriterLease.mockResolvedValue({ writable: true, release: vi.fn() }); });
  it('restores the exact date and animals after a long real-world absence', async () => {
    const runtime = advanceRuntime(createRuntime(createWorld('2026-09-21T12:00:00.000Z'), 'calendar-session'), 7 * TICKS_PER_GAME_DAY);
    mocks.readSlots.mockResolvedValue({ current: { raw: JSON.stringify(runtime), savedAt: '2020-01-01T00:00:00.000Z', token: 1 } });
    const loaded = await loadSession();
    expect(loaded.blocked).toBe(false);
    expect(loaded.runtime).toEqual(runtime);
    expect(loaded.absence).toBeNull();
    expect(mocks.commitSnapshot).not.toHaveBeenCalled();
  });
  it('keeps malformed saved data intact and blocks autosave', async () => {
    mocks.readSlots.mockResolvedValue({ current: { raw: '{broken', savedAt: '2020-01-01T00:00:00.000Z', token: 1 } });
    const loaded = await loadSession();
    expect(loaded.blocked).toBe(true);
    expect(loaded.warning).toContain('preserved');
    expect(mocks.commitSnapshot).not.toHaveBeenCalled();
  });
});
