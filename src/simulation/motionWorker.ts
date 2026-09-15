/// <reference lib="webworker" />
import { BEHAVIOR_STATES, createBehaviorWorld, feed, startle, stepBehavior, synchronizeActors, type BehaviorWorld } from './behavior';
import { MOTION_PROTOCOL, TRANSFORM_STRIDE, type FromMotionWorker, type PlaybackSpeed, type ToMotionWorker } from './protocol';
import { TICK_MS } from './time';

const scope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
let world: BehaviorWorld = createBehaviorWorld([]), tick = 0, speed: PlaybackSpeed = 0, timer = 0;

function send(message: FromMotionWorker, transfer: Transferable[] = []) { scope.postMessage(message, transfer); }
function entities(type: 'ready' | 'entities') {
  const ids = world.actors.map(actor => actor.id);
  send(type === 'ready' ? { type, protocol: MOTION_PROTOCOL, ids, tick } : { type, protocol: MOTION_PROTOCOL, ids });
}
function frame(stepMs: number) {
  const count = world.actors.length, index = new Map(world.actors.map((actor, i) => [actor.id, i]));
  const transforms = new Float32Array(count * TRANSFORM_STRIDE), states = new Uint8Array(count), reasons = new Uint8Array(count);
  const leaders = new Int16Array(count), food = new Float32Array(world.pellets.length * 2);
  world.actors.forEach((actor, i) => {
    transforms.set([actor.x, actor.y, actor.vx, actor.vy], i * TRANSFORM_STRIDE);
    states[i] = BEHAVIOR_STATES.indexOf(actor.state);
    reasons[i] = actor.reasons;
    leaders[i] = actor.leader === null ? -1 : index.get(actor.leader) ?? -1;
  });
  world.pellets.forEach((pellet, i) => food.set([pellet.x, pellet.y], i * 2));
  send({ type: 'frame', protocol: MOTION_PROTOCOL, tick, transforms, states, reasons, leaders, food, stepMs }, [transforms.buffer, states.buffer, reasons.buffer, leaders.buffer, food.buffer]);
}
function step(count: number) {
  const started = performance.now();
  for (let i = 0; i < count; i++) { tick++; world = stepBehavior(world); }
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
        world = { ...createBehaviorWorld(message.fish, message.planted === true), footprints: message.footprints }; tick = message.tick; speed = message.speed;
        entities('ready'); frame(0); startTimer(); break;
      case 'synchronize': world = synchronizeActors(world, message.fish); entities('entities'); frame(0); break;
      case 'playback': speed = message.speed; break;
      case 'environment': world = { ...world, planted: message.planted, footprints: message.footprints }; break;
      case 'feed': world = feed(world); frame(0); break;
      case 'startle': world = startle(world, message.x, message.y); frame(0); break;
      case 'benchmark': {
        const saved = world, started = performance.now();
        for (let i = 0; i < message.steps; i++) world = stepBehavior(world);
        const workerMs = performance.now() - started, fish = world.actors.length;
        world = saved;
        send({ type: 'benchmark', protocol: MOTION_PROTOCOL, requestId: message.requestId, fish, steps: message.steps, workerMs });
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
