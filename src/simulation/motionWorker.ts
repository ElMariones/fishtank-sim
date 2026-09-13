/// <reference lib="webworker" />
import { createActor, stepMotion, type Actor, type Food } from './motion';
import { MOTION_PROTOCOL, TRANSFORM_STRIDE, type FromMotionWorker, type ToMotionWorker } from './protocol';
import { TICK_MS } from './time';

const scope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
let actors: Actor[] = [], tick = 0, speed: 0 | 1 | 2 | 4 = 0, food: Food | null = null, timer = 0;

function send(message: FromMotionWorker, transfer: Transferable[] = []) { scope.postMessage(message, transfer); }
function entities(type: 'ready' | 'entities') {
  const ids = actors.map(actor => actor.id);
  send(type === 'ready' ? { type, protocol: MOTION_PROTOCOL, ids, tick } : { type, protocol: MOTION_PROTOCOL, ids });
}
function frame(stepMs: number) {
  const transforms = new Float32Array(actors.length * TRANSFORM_STRIDE);
  actors.forEach((actor, index) => transforms.set([actor.x, actor.y, actor.vx, actor.vy], index * TRANSFORM_STRIDE));
  send({ type: 'frame', protocol: MOTION_PROTOCOL, tick, transforms, stepMs }, [transforms.buffer]);
}
function step(count: number) {
  const started = performance.now();
  for (let i = 0; i < count; i++) {
    tick++;
    actors = stepMotion(actors, tick * TICK_MS / 1000, food);
    if (food && --food.remaining <= 0) food = null;
  }
  return performance.now() - started;
}
function startTimer() {
  if (timer) return;
  timer = scope.setInterval(() => { if (speed) frame(step(speed)); }, TICK_MS);
}

scope.onmessage = (event: MessageEvent<ToMotionWorker>) => {
  try {
    const message = event.data;
    if (!message || message.protocol !== MOTION_PROTOCOL) throw new Error('Unsupported motion protocol.');
    switch (message.type) {
      case 'initialize':
        actors = message.fish.map(createActor); tick = message.tick; speed = message.speed; food = null;
        entities('ready'); frame(0); startTimer(); break;
      case 'synchronize': {
        const existing = new Map(actors.map(actor => [actor.id, actor]));
        actors = message.fish.map(fish => existing.get(fish.id) ?? createActor(fish));
        entities('entities'); frame(0); break;
      }
      case 'playback': speed = message.speed; break;
      case 'feed': food = { x: 0.5, y: 0.24, remaining: 8 / (TICK_MS / 1000) }; break;
      case 'benchmark': {
        const copy = actors.map(actor => ({ ...actor, phenotype: { ...actor.phenotype } }));
        const started = performance.now();
        for (let i = 0; i < message.steps; i++) actors = stepMotion(actors, (tick + i) * TICK_MS / 1000, null);
        const workerMs = performance.now() - started;
        actors = copy;
        send({ type: 'benchmark', protocol: MOTION_PROTOCOL, requestId: message.requestId, fish: actors.length, steps: message.steps, workerMs });
        break;
      }
      case 'simulate-fault': throw new Error('Requested diagnostic worker fault.');
      case 'shutdown': if (timer) scope.clearInterval(timer); timer = 0; scope.close(); break;
    }
  } catch (error) {
    send({ type: 'fault', protocol: MOTION_PROTOCOL, code: 'MOTION_WORKER_FAULT', message: error instanceof Error ? error.message : 'Motion worker failed.', recoverable: true });
    throw error;
  }
};
