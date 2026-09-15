import { describe, expect, it } from 'vitest';
import type { Fish } from '../src/core/types';
import { createWorld } from '../src/core/world';
import { MotionWorkerClient } from '../src/simulation/motionClient';
import type { FromMotionWorker, ToMotionWorker } from '../src/simulation/protocol';

class FakeWorker {
  onmessage: ((event: MessageEvent<FromMotionWorker>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  messages: ToMotionWorker[] = [];
  terminated = false;
  postMessage(message: ToMotionWorker) { this.messages.push(message); }
  terminate() { this.terminated = true; }
  send(message: FromMotionWorker) { this.onmessage?.({ data: message } as MessageEvent<FromMotionWorker>); }
  fail(message = 'boom') { this.onerror?.({ message, preventDefault() {} } as ErrorEvent); }
}

describe('FS-202 motion worker lifecycle', () => {
  it('initializes, recovers once, exposes a manual restart and terminates every replaced', () => {
    const workers: FakeWorker[] = [], statuses: string[] = [], fish: Fish[] = createWorld('2026-09-13T12:00:00.000Z').fish;
    const client = new MotionWorkerClient(
      () => { const worker = new FakeWorker(); workers.push(worker); return worker as unknown as Worker; },
      { onMessage() {}, onStatus(status) { statuses.push(status); } },
    );
    client.start(fish, 12, 2, true);
    expect(workers[0].messages[0]).toMatchObject({ type: 'initialize', protocol: 3, tick: 12, speed: 2, planted: true });
    workers[0].send({ type: 'ready', protocol: 3, ids: fish.map(f => f.id), tick: 12 });
    expect(statuses).toEqual(['ready']);
    const footprints = [{ id: 'DC-1', kind: 'rock' as const, x: 0.5, y: 0.5, radius: 0.055 }];
    client.environment(false, footprints); client.feed(); client.startle(0.4, 0.6);
    expect(workers[0].messages.slice(1).map(message => message.type)).toEqual(['environment', 'feed', 'startle']);
    workers[0].fail();
    expect(workers[0].terminated).toBe(true);
    expect(workers).toHaveLength(2);
    // The restarted worker keeps the latest environment.
    expect(workers[1].messages[0]).toMatchObject({ type: 'initialize', planted: false, footprints });
    workers[1].send({ type: 'ready', protocol: 3, ids: fish.map(f => f.id), tick: 12 });
    expect(statuses).toEqual(['ready', 'recovering', 'recovered']);
    workers[1].fail('second fault');
    expect(statuses.at(-1)).toBe('failed');
    client.restart();
    expect(workers).toHaveLength(3);
    client.destroy();
    expect(workers[2].messages.at(-1)).toMatchObject({ type: 'shutdown' });
    expect(workers[2].terminated).toBe(true);
  });

  it('ignores late events from a worker that was replaced', () => {
    const workers: FakeWorker[] = [], messages: FromMotionWorker[] = [];
    const client = new MotionWorkerClient(
      () => { const worker = new FakeWorker(); workers.push(worker); return worker as unknown as Worker; },
      { onMessage(message) { messages.push(message); }, onStatus() {} },
    );
    client.start([], 0, 0);
    workers[0].fail();
    workers[0].send({ type: 'frame', protocol: 3, tick: 9, transforms: new Float32Array(), states: new Uint8Array(), reasons: new Uint8Array(), leaders: new Int16Array(), food: new Float32Array(), stepMs: 0 });
    expect(messages).toEqual([]);
    client.destroy();
  });
});
