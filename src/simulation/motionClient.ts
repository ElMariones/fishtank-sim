import type { Footprint } from './footprints';
import type { Fish } from '../core/types';
import { MOTION_PROTOCOL, type FromMotionWorker, type PlaybackSpeed, type ToMotionWorker } from './protocol';

type WorkerFactory = () => Worker;
type Callbacks = {
  onMessage: (message: FromMotionWorker) => void;
  onStatus: (status: 'ready' | 'recovering' | 'recovered' | 'failed', message?: string) => void;
};

/** Owns worker lifecycle and one automatic restart. React cleanup calls destroy, which always terminates the worker. */
export class MotionWorkerClient {
  private worker: Worker | null = null;
  private destroyed = false;
  private restarts = 0;
  private initial: Extract<ToMotionWorker, { type: 'initialize' }> | null = null;
  constructor(private readonly factory: WorkerFactory, private readonly callbacks: Callbacks) {}

  start(fish: Fish[], tick: number, speed: PlaybackSpeed, planted = false, footprints?: readonly Footprint[]) {
    this.initial = { type: 'initialize', protocol: MOTION_PROTOCOL, fish, tick, speed, planted, footprints };
    this.spawn(false);
  }
  /** Load another tank into the running worker: it rebuilds its world from `initialize` without a new worker start-up. */
  reset(fish: Fish[], tick: number, speed: PlaybackSpeed, planted = false, footprints?: readonly Footprint[]) {
    this.initial = { type: 'initialize', protocol: MOTION_PROTOCOL, fish, tick, speed, planted, footprints };
    if (this.worker) this.worker.postMessage(this.initial); else this.spawn(false);
  }
  synchronize(fish: Fish[]) { this.post({ type: 'synchronize', protocol: MOTION_PROTOCOL, fish }); if (this.initial) this.initial.fish = fish; }
  playback(speed: PlaybackSpeed) { this.post({ type: 'playback', protocol: MOTION_PROTOCOL, speed }); if (this.initial) this.initial.speed = speed; }
  environment(planted: boolean, footprints?: readonly Footprint[]) { this.post({ type: 'environment', protocol: MOTION_PROTOCOL, planted, footprints }); if (this.initial) { this.initial.planted = planted; this.initial.footprints = footprints; } }
  feed() { this.post({ type: 'feed', protocol: MOTION_PROTOCOL }); }
  startle(x: number, y: number) { this.post({ type: 'startle', protocol: MOTION_PROTOCOL, x, y }); }
  simulateFaultForTest() { this.post({ type: 'simulate-fault', protocol: MOTION_PROTOCOL }); }
  restart() { this.restarts = 0; this.spawn(true); }
  destroy() {
    this.destroyed = true;
    this.post({ type: 'shutdown', protocol: MOTION_PROTOCOL });
    this.worker?.terminate(); this.worker = null;
  }
  private post(message: ToMotionWorker) { this.worker?.postMessage(message); }
  private spawn(manual: boolean) {
    this.worker?.terminate();
    if (this.destroyed || !this.initial) return;
    const worker = this.factory(); this.worker = worker;
    worker.onmessage = (event: MessageEvent<FromMotionWorker>) => {
      if (this.worker !== worker) return;
      if (event.data.type === 'fault') this.recover(event.data.message);
      else {
        if (event.data.type === 'ready') this.callbacks.onStatus(manual || this.restarts ? 'recovered' : 'ready');
        this.callbacks.onMessage(event.data);
      }
    };
    worker.onerror = event => { event.preventDefault(); if (this.worker === worker) this.recover(event.message || 'Motion worker stopped unexpectedly.'); };
    worker.postMessage(this.initial);
  }
  private recover(message: string) {
    if (this.destroyed) return;
    if (this.restarts++ < 1) { this.callbacks.onStatus('recovering', message); this.spawn(false); }
    else { this.worker?.terminate(); this.worker = null; this.callbacks.onStatus('failed', message); }
  }
}
