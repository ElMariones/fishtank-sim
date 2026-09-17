import { useEffect, useRef, useState } from 'react';
import { anatomyFor } from '../core/anatomy';
import { hash, random } from '../core/random';
import type { Fish, Tank } from '../core/types';
import { drawEgg, drawFish } from '../rendering/fish';
import { currentPhenotype } from '../rendering/stage';
import { facingFor, fishPose, pickActor, visualGrowth } from '../rendering/tankLayout';
import { BEHAVIOR_STATES, type BehaviorSummary } from '../simulation/behavior';
import { createActor, type Actor } from '../simulation/motion';
import { habitatFootprints } from '../simulation/footprints';
import { AquascapeRenderer, type Scene } from '../rendering/aquascape';
import { styleOf } from '../core/aquascape';
import { decorationsOf } from '../core/tankManagement';
import { MotionWorkerClient } from '../simulation/motionClient';
import { TRANSFORM_STRIDE, type FromMotionWorker, type PlaybackSpeed } from '../simulation/protocol';
import { TICK_MS } from '../simulation/time';

type Props = {
  fish: Fish[]; eggs: number; tank: Tank; selectedId: string; onSelect: (id: string) => void; paused: boolean; speed: number; feedSignal: number;
  /** Called when the selected fish's behavior state, reasons or leader change; null when it is not swimming here. */
  onBehavior?: (behavior: BehaviorSummary | null) => void;
  /** A draft aquascape to draw instead of the saved one (FS-117 editor). Fish keep steering by the saved layout. */
  preview?: PreviewSource | null;
  /** While editing, the aquarium is frozen (no motion, no sway) and clicks belong to the editor overlay. */
  editing?: boolean;
};
/** Anything that can hand the canvas a scene and say when it changed, such as the aquascape editor's draft store. */
export type PreviewSource = { scene: () => Scene; subscribe: (listener: () => void) => () => void };
type WorkerState = { status: 'starting' | 'ready' | 'recovering' | 'recovered' | 'failed'; message: string };
type BehaviorFrame = { states: Uint8Array; reasons: Uint8Array; leaders: Int16Array };
/** What the last painted frame showed for one fish, so a click picks exactly what was drawn. */
type Painted = { actor: Actor; facing: number; growth: number };
const workerFactory = () => new Worker(new URL('../simulation/motionWorker.ts', import.meta.url), { type: 'module', name: 'fishtank-motion' });
// A hidden page paints nothing, so visual motion pauses there instead of spending worker time.
const playbackSpeed = (props: Props): PlaybackSpeed => document.hidden || props.paused || props.editing ? 0 : props.speed as PlaybackSpeed;
/** Canvas pixel density cap: above 1.5 the extra pixels cost far more fill time than they add detail to soft water. */
const MAX_DPR = 1.5;
/** Facing swings through side-on at this rate per second, so a turn reads as the fish swinging round (FS-306). */
const TURN_PER_SECOND = 4;
/** Swim phases wrap at 4π: the dorsal sway runs at half the fin rate. */
const PHASE_WRAP = Math.PI * 4;

const scenes = new WeakMap<Tank, Scene>();
/** One scene object per saved tank record, so the renderer's static layer is rebuilt only when the tank changes. */
function savedScene(tank: Tank): Scene {
  let scene = scenes.get(tank);
  if (!scene) { scene = { decorations: decorationsOf(tank), style: styleOf(tank) }; scenes.set(tank, scene); }
  return scene;
}

export function TankCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  const actors = useRef<Actor[]>(props.fish.map(createActor));
  const previous = useRef(new Map<string, Actor>());
  const frameClock = useRef({ receivedAt: 0, fromTime: 0 });
  const facings = useRef(new Map<string, number>());
  const phases = useRef(new Map<string, { tail: number; fin: number }>());
  const painted = useRef<Painted[]>([]);
  const workerIds = useRef<string[]>(props.fish.map(fish => fish.id));
  const client = useRef<MotionWorkerClient | null>(null);
  const simulationTime = useRef(0);
  const pellets = useRef<Float32Array>(new Float32Array());
  const behaviorFrame = useRef<BehaviorFrame | null>(null);
  const reported = useRef('');
  const lastFeedSignal = useRef(props.feedSignal);
  const [workerState, setWorkerState] = useState<WorkerState>({ status: 'starting', message: '' });
  /** A still aquarium (paused or editing) repaints only when something it shows has changed. */
  const dirty = useRef(true);
  latest.current = props;
  dirty.current = true;

  /** Report the selected fish's current behavior when it differs from the last report. */
  const reportBehavior = () => {
    const { selectedId, onBehavior } = latest.current, frame = behaviorFrame.current;
    const index = frame ? workerIds.current.indexOf(selectedId) : -1;
    const summary: BehaviorSummary | null = frame && index >= 0 && index < frame.states.length ? {
      state: BEHAVIOR_STATES[frame.states[index]] ?? 'cruise', reasons: frame.reasons[index],
      leaderId: frame.leaders[index] >= 0 ? workerIds.current[frame.leaders[index]] ?? null : null,
    } : null;
    const key = summary ? `${selectedId}:${summary.state}:${summary.reasons}:${summary.leaderId}` : `${selectedId}:none`;
    if (key !== reported.current) { reported.current = key; onBehavior?.(summary); }
  };

  useEffect(() => {
    const receive = (message: FromMotionWorker) => {
      if (message.type === 'ready' || message.type === 'entities') workerIds.current = message.ids;
      if (message.type !== 'frame') return;
      dirty.current = true;
      // Painting interpolates from the previous frame to this one over one 50 ms step.
      previous.current = new Map(actors.current.map(actor => [actor.id, actor]));
      frameClock.current = { receivedAt: performance.now(), fromTime: simulationTime.current };
      simulationTime.current = message.tick * TICK_MS / 1000;
      pellets.current = message.food;
      behaviorFrame.current = { states: message.states, reasons: message.reasons, leaders: message.leaders };
      const byId = new Map(actors.current.map(actor => [actor.id, actor]));
      const fishById = new Map(latest.current.fish.map(fish => [fish.id, fish]));
      actors.current = workerIds.current.flatMap((id, index) => {
        // Fish bred, moved or bought into this tank after the worker started need an actor for drawing and picking.
        const fish = fishById.get(id);
        const actor = byId.get(id) ?? (fish ? createActor(fish) : null);
        if (!actor) return [];
        const offset = index * TRANSFORM_STRIDE;
        return [{ ...actor, x: message.transforms[offset], y: message.transforms[offset + 1], vx: message.transforms[offset + 2], vy: message.transforms[offset + 3] }];
      });
      reportBehavior();
    };
    const motion = new MotionWorkerClient(workerFactory, {
      onMessage: receive,
      onStatus: (status, message = '') => setWorkerState({ status, message }),
    });
    client.current = motion;
    actors.current = props.fish.map(createActor);
    previous.current = new Map(); facings.current.clear(); phases.current.clear(); painted.current = [];
    frameClock.current = { receivedAt: 0, fromTime: 0 };
    simulationTime.current = 0;
    behaviorFrame.current = null;
    motion.start(props.fish, 0, playbackSpeed(props), props.tank.planted, habitatFootprints(props.tank));
    const fault = () => { if (import.meta.env.DEV) motion.simulateFaultForTest(); };
    window.addEventListener('fishtank:simulate-worker-fault', fault);
    return () => {
      window.removeEventListener('fishtank:simulate-worker-fault', fault);
      client.current = null;
      motion.destroy();
    };
    // A tank switch creates a fresh deterministic visual trajectory; persistent lifecycle time is independent.
  }, [props.tank.id]);

  useEffect(() => { client.current?.synchronize(props.fish); }, [props.fish]);
  useEffect(() => { client.current?.environment(props.tank.planted, habitatFootprints(props.tank)); }, [props.tank.planted, props.tank.decorations]);
  useEffect(() => {
    const apply = () => client.current?.playback(playbackSpeed(latest.current));
    apply();
    document.addEventListener('visibilitychange', apply);
    return () => document.removeEventListener('visibilitychange', apply);
  }, [props.paused, props.speed, props.editing]);
  useEffect(() => props.preview?.subscribe(() => { dirty.current = true; }), [props.preview]);
  useEffect(() => {
    if (props.feedSignal !== lastFeedSignal.current) client.current?.feed();
    lastFeedSignal.current = props.feedSignal;
  }, [props.feedSignal]);
  // A new selection reads the latest frame at once, even while the aquarium is paused.
  useEffect(() => { reportBehavior(); }, [props.selectedId]);

  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let width = 800, height = 500, frame = 0, lastPaint = performance.now();
    const renderer = new AquascapeRenderer();
    const resize = new ResizeObserver(entries => {
      width = entries[0].contentRect.width; height = entries[0].contentRect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = width * dpr; canvas.height = height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dirty.current = true;
    });
    resize.observe(canvas);
    const render = () => {
      const current = latest.current, now = performance.now(), dt = Math.min(0.1, (now - lastPaint) / 1000);
      const playing = playbackSpeed(current);
      const blend = Math.min(1, Math.max(0, (now - frameClock.current.receivedAt) / TICK_MS));
      // Frozen and settled: nothing moves, so skip the paint until a prop, frame, draft or size change marks it dirty.
      if (!playing && blend >= 1 && !dirty.current) { lastPaint = now; frame = requestAnimationFrame(render); return; }
      dirty.current = blend < 1;
      lastPaint = now;
      const time = frameClock.current.fromTime + (simulationTime.current - frameClock.current.fromTime) * blend;
      ctx.clearRect(0, 0, width, height);
      const scene = current.preview?.scene() ?? savedScene(current.tank);
      renderer.paintBack(ctx, width, height, scene, time);
      renderer.paintPlants(ctx, width, height, scene, time, 'back');
      if (current.eggs > 0) {
        // Incubating eggs rest on the substrate as one cluster; the life model, not the drawing, decides when they hatch.
        const rng = random(hash(`egg-cluster:${current.tank.id}`)), anchor = current.tank.planted ? 0.22 : 0.5, radius = Math.max(2, Math.min(width, height) / 180);
        for (let i = 0, total = Math.min(current.eggs, 40); i < total; i++) {
          const angle = rng() * Math.PI * 2, reach = Math.sqrt(rng());
          ctx.save(); ctx.translate((anchor + Math.cos(angle) * reach * 0.06) * width, height - 30 + Math.sin(angle) * reach * 10);
          drawEgg(ctx, radius, i, 0.5, time); ctx.restore();
        }
      }
      for (let i = 0; i < 26; i++) {
        const x = (i * 137.3 + Math.sin(time * 0.2 + i) * 10) % width, y = height - ((i * 53.7 + time * (3 + i % 3)) % height);
        ctx.fillStyle = 'rgba(220,245,240,.16)'; ctx.beginPath(); ctx.arc(x, y, 0.7 + i % 2, 0, Math.PI * 2); ctx.fill();
      }
      const food = pellets.current;
      if (food.length) {
        ctx.fillStyle = '#dab36b';
        for (let i = 0; i < food.length; i += 2) { ctx.beginPath(); ctx.arc(food[i] * width, food[i + 1] * height, 2.2, 0, Math.PI * 2); ctx.fill(); }
      }
      const fishById = new Map(current.fish.map(fish => [fish.id, fish])), paintedNow: Painted[] = [];
      for (const actor of actors.current) {
        const fish = fishById.get(actor.id);
        if (!fish) continue;
        const before = previous.current.get(actor.id) ?? actor, mix = (from: number, to: number) => from + (to - from) * blend;
        // Drawn at the current life stage (FS-306); the worker keeps steering with the adult phenotype's inherited movement.
        const shown: Actor = { ...actor, x: mix(before.x, actor.x), y: mix(before.y, actor.y), vx: mix(before.vx, actor.vx), vy: mix(before.vy, actor.vy), phenotype: currentPhenotype(actor.phenotype, fish) };
        const target = facingFor(shown), was = facings.current.get(actor.id) ?? target, turn = playing ? dt * TURN_PER_SECOND : 0;
        const facing = was + Math.max(-turn, Math.min(turn, target - was));
        facings.current.set(actor.id, facing);
        const effort = Math.min(1, Math.hypot(shown.vx, shown.vy) / Math.max(actor.phenotype.speed, 1e-6));
        const phase = phases.current.get(actor.id) ?? { tail: hash(actor.id) % 628 / 100, fin: hash(`${actor.id}:fin`) % 628 / 100 };
        phase.tail = (phase.tail + dt * playing * (3 + 5 * effort + 2 * actor.phenotype.activity)) % PHASE_WRAP;
        phase.fin = (phase.fin + dt * playing * (2.5 + 2 * actor.phenotype.activity)) % PHASE_WRAP;
        phases.current.set(actor.id, phase);
        const growth = visualGrowth(fish.life.lengthCm, actor.phenotype.adultLengthCm), pose = fishPose(shown, width, height, growth, facing);
        ctx.save(); ctx.translate(pose.x, pose.y);
        if (actor.id === current.selectedId) {
          const b = anatomyFor(shown.phenotype).bounds, length = pose.bodyLength;
          ctx.save(); ctx.scale(pose.flip < 0 ? -1 : 1, 1); ctx.rotate(pose.angle);
          ctx.strokeStyle = '#89f0dc75'; ctx.lineWidth = 1; ctx.setLineDash([3, 6]);
          ctx.beginPath(); ctx.ellipse((b.minX + b.maxX) / 2 * length, (b.minY + b.maxY) / 2 * length, (b.maxX - b.minX) / 2 * length * 1.06, (b.maxY - b.minY) / 2 * length * 1.12, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
          ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#89f0dc'; ctx.fillText(fish.name, 0, -Math.max(-b.minY, b.maxY) * length * 1.15 - 6);
        }
        ctx.scale(pose.flip, 1); ctx.rotate(pose.angle);
        drawFish(ctx, shown.phenotype, fish.birthSeed, pose.size, time, { tailPhase: phase.tail, finPhase: phase.fin, effort });
        ctx.restore();
        paintedNow.push({ actor: shown, facing, growth });
      }
      renderer.paintPlants(ctx, width, height, scene, time, 'front');
      renderer.paintFront(ctx, width, height, scene, time);
      painted.current = paintedNow;
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); };
  }, [props.tank.id]);

  return <>
    <canvas ref={canvasRef} className="tank-canvas" role="img" aria-label={`${props.tank.name}, ${props.fish.length} swimming fish${props.eggs ? ` and ${props.eggs} incubating eggs` : ''}. Select a fish using the collection below.`}
      onClick={event => {
        if (props.editing) return;
        const rect = event.currentTarget.getBoundingClientRect(), shown = painted.current, byId = new Map(shown.map(entry => [entry.actor.id, entry]));
        const x = event.clientX - rect.left, y = event.clientY - rect.top;
        const id = pickActor(shown.map(entry => entry.actor), rect.width, rect.height, x, y, 6,
          actor => byId.get(actor.id)?.growth ?? 1, actor => byId.get(actor.id)?.facing ?? facingFor(actor));
        // Clicking open water taps the glass: nearby fish are startled, and shy ones look for cover.
        if (id) props.onSelect(id); else client.current?.startle(x / rect.width, y / rect.height);
      }} />
    {workerState.status === 'recovering' || workerState.status === 'recovered' || workerState.status === 'failed' ? <div className={`worker-state ${workerState.status}`} role="status">
      {workerState.status === 'recovering' ? 'Aquarium motion stopped; restarting it…' : workerState.status === 'recovered' ? 'Aquarium motion recovered.' : `Aquarium motion is paused. ${workerState.message}`}
      {workerState.status === 'failed' ? <button onClick={() => client.current?.restart()}>Restart aquarium motion</button> : null}
    </div> : null}
  </>;
}
