import { useEffect, useRef } from 'react';
import { anatomyFor } from '../core/anatomy';
import type { Fish, Tank } from '../core/types';
import { drawFish } from '../rendering/fish';
import { fishPose, pickActor } from '../rendering/tankLayout';
import { createActor, stepMotion, type Actor, type Food } from '../simulation/motion';

type Props = { fish: Fish[]; tank: Tank; selectedId: string; onSelect: (id: string) => void; paused: boolean; speed: number; feedSignal: number };

export function TankCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  const actors = useRef<Actor[]>([]);
  latest.current = props;
  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let width = 800, height = 500, frame = 0, previous = 0, time = 0, accumulator = 0;
    let food: Food | null = null, lastFeed = latest.current.feedSignal;
    const resize = new ResizeObserver(entries => {
      width = entries[0].contentRect.width; height = entries[0].contentRect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr; canvas.height = height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    resize.observe(canvas);
    const render = (now: number) => {
      const current = latest.current;
      const dt = previous ? Math.min((now - previous) / 1000, 0.1) : 0;
      previous = now;
      const old = new Map(actors.current.map(a => [a.id, a]));
      actors.current = current.fish.map(fish => old.get(fish.id) ?? createActor(fish));
      if (current.feedSignal !== lastFeed) { food = { x: 0.5, y: 0.24, remaining: 8 }; lastFeed = current.feedSignal; }
      if (!current.paused && !document.hidden) {
        accumulator += dt * current.speed;
        while (accumulator >= 0.05) {
          time += 0.05; actors.current = stepMotion(actors.current, time, food);
          if (food) { food.remaining -= 0.05; if (food.remaining <= 0) food = null; }
          accumulator -= 0.05;
        }
      }
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
      if (food) {
        ctx.fillStyle = '#dab36b';
        for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.arc(width * food.x + Math.sin(i * 9) * 45, height * food.y + Math.cos(i * 7) * 18, 2, 0, Math.PI * 2); ctx.fill(); }
      }
      const fishById = new Map(current.fish.map(f => [f.id, f]));
      for (const actor of actors.current) {
        const fish = fishById.get(actor.id);
        if (!fish) continue;
        const pose = fishPose(actor, width, height);
        ctx.save(); ctx.translate(pose.x, pose.y);
        if (actor.id === current.selectedId) {
          const b = anatomyFor(actor.phenotype).bounds, l = pose.bodyLength;
          ctx.save(); ctx.scale(pose.flip, 1); ctx.rotate(pose.angle);
          ctx.strokeStyle = '#c5efd275'; ctx.lineWidth = 1; ctx.setLineDash([3, 6]);
          ctx.beginPath(); ctx.ellipse((b.minX + b.maxX) / 2 * l, (b.minY + b.maxY) / 2 * l, (b.maxX - b.minX) / 2 * l * 1.06, (b.maxY - b.minY) / 2 * l * 1.12, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
          ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#d5ebdd'; ctx.fillText(fish.name, 0, -Math.max(-b.minY, b.maxY) * l * 1.15 - 6);
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

  return <canvas ref={canvasRef} className="tank-canvas" role="img" aria-label={`${props.tank.name}, ${props.fish.length} swimming fish. Select a fish using the collection below.`}
    onClick={event => {
      const rect = event.currentTarget.getBoundingClientRect();
      const id = pickActor(actors.current, rect.width, rect.height, event.clientX - rect.left, event.clientY - rect.top);
      if (id) props.onSelect(id);
    }} />;
}
