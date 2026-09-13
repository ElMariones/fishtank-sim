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
    client.start(fish, 12, 2);
    expect(workers[0].messages[0]).toMatchObject({ type: 'initialize', protocol: 1, tick: 12, speed: 2 });
    workers[0].send({ type: 'ready', protocol: 1, ids: fish.map(f => f.id), tick: 12 });
    expect(statuses).toEqual(['ready']);
    workers[0].fail();
    expect(workers[0].terminated).toBe(true);
    expect(workers).toHaveLength(2);
    workers[1].send({ type: 'ready', protocol: 1, ids: fish.map(f => f.id), tick: 12 });
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
    workers[0].send({ type: 'frame', protocol: 1, tick: 9, transforms: new Float32Array(), stepMs: 0 });
    expect(messages).toEqual([]);
    client.destroy();
  });
});
