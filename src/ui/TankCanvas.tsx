import { useEffect, useRef, useState } from 'react';
import { anatomyFor } from '../core/anatomy';
import type { Fish, Tank } from '../core/types';
import { drawFish } from '../rendering/fish';
import { fishPose, pickActor } from '../rendering/tankLayout';
import { createActor, type Actor } from '../simulation/motion';
import { MotionWorkerClient } from '../simulation/motionClient';
import { TRANSFORM_STRIDE, type FromMotionWorker } from '../simulation/protocol';
import { TICK_MS } from '../simulation/time';

type Props = { fish: Fish[]; tank: Tank; selectedId: string; onSelect: (id: string) => void; paused: boolean; speed: number; feedSignal: number };
type WorkerState = { status: 'starting' | 'ready' | 'recovering' | 'recovered' | 'failed'; message: string };
const workerFactory = () => new Worker(new URL('../simulation/motionWorker.ts', import.meta.url), { type: 'module', name: 'fishtank-motion' });
// A hidden page paints nothing, so visual motion pauses there instead of spending worker time.
const playbackSpeed = (props: Props) => document.hidden || props.paused ? 0 : props.speed as 1 | 2 | 4;

export function TankCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  const actors = useRef<Actor[]>(props.fish.map(createActor));
  const workerIds = useRef<string[]>(props.fish.map(fish => fish.id));
  const client = useRef<MotionWorkerClient | null>(null);
  const simulationTime = useRef(0);
  const foodUntil = useRef(0);
  const [workerState, setWorkerState] = useState<WorkerState>({ status: 'starting', message: '' });
  latest.current = props;

  useEffect(() => {
    const receive = (message: FromMotionWorker) => {
      if (message.type === 'ready' || message.type === 'entities') workerIds.current = message.ids;
      if (message.type !== 'frame') return;
      simulationTime.current = message.tick * TICK_MS / 1000;
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
    };
    const motion = new MotionWorkerClient(workerFactory, {
      onMessage: receive,
      onStatus: (status, message = '') => setWorkerState({ status, message }),
    });
    client.current = motion;
    actors.current = props.fish.map(createActor);
    motion.start(props.fish, 0, playbackSpeed(props));
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
  useEffect(() => {
    const apply = () => client.current?.playback(playbackSpeed(latest.current));
    apply();
    document.addEventListener('visibilitychange', apply);
    return () => document.removeEventListener('visibilitychange', apply);
  }, [props.paused, props.speed]);
  useEffect(() => {
    if (!props.feedSignal) return;
    foodUntil.current = simulationTime.current + 8;
    client.current?.feed();
  }, [props.feedSignal]);

  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let width = 800, height = 500, frame = 0;
    const resize = new ResizeObserver(entries => {
      width = entries[0].contentRect.width; height = entries[0].contentRect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr; canvas.height = height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    resize.observe(canvas);
    const render = () => {
      const current = latest.current, time = simulationTime.current;
      ctx.clearRect(0, 0, width, height);
      const water = ctx.createLinearGradient(0, 0, 0, height);
      water.addColorStop(0, '#193f44'); water.addColorStop(0.4, '#102f35'); water.addColorStop(1, '#091f27');
      ctx.fillStyle = water; ctx.fillRect(0, 0, width, height);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = '#a5e0cf04'; ctx.beginPath(); ctx.moveTo(width * i / 5, 0); ctx.lineTo(width * i / 5 + width * 0.18, 0); ctx.lineTo(width * i / 5 - width * 0.1 + Math.sin(time * 0.1) * 30, height); ctx.lineTo(width * i / 5 - width * 0.16, height); ctx.fill();
      }
      ctx.fillStyle = '#30433f'; ctx.beginPath(); ctx.moveTo(0, height); ctx.lineTo(0, height - 24); ctx.bezierCurveTo(width * 0.3, height - 2, width * 0.7, height - 45, width, height - 24); ctx.lineTo(width, height); ctx.fill();
      if (current.tank.planted) {
        for (let i = 0; i < 25; i++) {
          const x = (i < 14 ? i * 12 : width - (i - 14) * 14), plantHeight = 45 + (i * 31 % 115);
          ctx.strokeStyle = i % 2 ? '#42685380' : '#294f4680'; ctx.lineWidth = 3 + i % 5;
          ctx.beginPath(); ctx.moveTo(x, height); ctx.bezierCurveTo(x - 20, height - plantHeight * 0.4, x + 30, height - plantHeight * 0.7, x + Math.sin(time * 0.6 + i) * 12, height - plantHeight); ctx.stroke();
        }
      }
      for (let i = 0; i < 26; i++) {
        const x = (i * 137.3 + Math.sin(time * 0.2 + i) * 10) % width, y = height - ((i * 53.7 + time * (3 + i % 3)) % height);
        ctx.fillStyle = '#d6fff126'; ctx.beginPath(); ctx.arc(x, y, 0.7 + i % 2, 0, Math.PI * 2); ctx.fill();
      }
      if (time < foodUntil.current) {
        ctx.fillStyle = '#dab36b';
        for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.arc(width * 0.5 + Math.sin(i * 9) * 45, height * 0.24 + Math.cos(i * 7) * 18, 2, 0, Math.PI * 2); ctx.fill(); }
      }
      const fishById = new Map(current.fish.map(fish => [fish.id, fish]));
      for (const actor of actors.current) {
        const fish = fishById.get(actor.id);
        if (!fish) continue;
        const pose = fishPose(actor, width, height);
        ctx.save(); ctx.translate(pose.x, pose.y);
        if (actor.id === current.selectedId) {
          const b = anatomyFor(actor.phenotype).bounds, length = pose.bodyLength;
          ctx.save(); ctx.scale(pose.flip, 1); ctx.rotate(pose.angle);
          ctx.strokeStyle = '#c5efd275'; ctx.lineWidth = 1; ctx.setLineDash([3, 6]);
          ctx.beginPath(); ctx.ellipse((b.minX + b.maxX) / 2 * length, (b.minY + b.maxY) / 2 * length, (b.maxX - b.minX) / 2 * length * 1.06, (b.maxY - b.minY) / 2 * length * 1.12, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
          ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#d5ebdd'; ctx.fillText(fish.name, 0, -Math.max(-b.minY, b.maxY) * length * 1.15 - 6);
        }
        ctx.scale(pose.flip, 1); ctx.rotate(pose.angle);
        drawFish(ctx, actor.phenotype, fish.birthSeed, pose.size, time);
        ctx.restore();
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); };
  }, [props.tank.id]);

  return <>
    <canvas ref={canvasRef} className="tank-canvas" role="img" aria-label={`${props.tank.name}, ${props.fish.length} swimming fish. Select a fish using the collection below.`}
      onClick={event => {
        const rect = event.currentTarget.getBoundingClientRect();
        const id = pickActor(actors.current, rect.width, rect.height, event.clientX - rect.left, event.clientY - rect.top);
        if (id) props.onSelect(id);
      }} />
    {workerState.status === 'recovering' || workerState.status === 'recovered' || workerState.status === 'failed' ? <div className={`worker-state ${workerState.status}`} role="status">
      {workerState.status === 'recovering' ? 'Aquarium motion stopped; restarting it…' : workerState.status === 'recovered' ? 'Aquarium motion recovered.' : `Aquarium motion is paused. ${workerState.message}`}
      {workerState.status === 'failed' ? <button onClick={() => client.current?.restart()}>Restart aquarium motion</button> : null}
    </div> : null}
  </>;
}
