import { BACKENDS, type Backend } from './backends';
import { SCENARIOS, buildScene, stepScene, tierMix, type Scenario } from './scene';

/**
 * FS-701 renderer spike driver.
 *
 * Runs every backend over every scenario with the same stepped scene and reports frame cost, the tier mix it drew and
 * the bytes each backend's caches hold. It is a measuring page, not part of the application: `npm run build` builds
 * only index.html, so nothing here — including PixiJS — reaches the shipped bundle.
 *
 * **Why not requestAnimationFrame.** Animation frames are capped to the display's refresh rate, so two backends that
 * both finish inside 16.7 ms both report 60 fps and the comparison says nothing. They are also suspended entirely when
 * the window is not being painted. Each frame here is therefore drawn and then flushed to completion in a plain loop,
 * which measures the cost of producing a frame rather than the interval the compositor chose to hand one over.
 */

/**
 * Frames drawn and thrown away before measuring.
 *
 * This has to cover the whole flipbook, not just the JIT. Every fish is genetically unique, so nothing is shared
 * between them: a 200-fish scene needs roughly 200 x 12 phases x 2 effort steps of frames before the cache is warm.
 * At 40 frames the caching backends were still filling, and their medians measured the fill rather than the steady
 * state — the mistake that made the first run of this spike read as "caching does not help".
 */
const WARMUP_FRAMES = 700;
/** Frames measured per case. Enough for a stable p95 without leaving the page unresponsive for long. */
const MEASURED_FRAMES = 150;
/** Frames drawn between yields back to the event loop, so the browser stays responsive during a run. */
const CHUNK = 15;

type Result = {
  scenario: string;
  backend: string;
  /** Milliseconds to draw and complete one frame. */
  p50: number; p95: number; max: number;
  /** Frames per second implied by the median, uncapped by the display's refresh rate. */
  fps: number;
  /** Per-fish cost at the median, the figure that scales to a different tank size. */
  perFish: number;
  /** Seconds spent filling the cache before the steady state, which is a real cost even though it is paid once. */
  warmupS: number;
  /** The backend's own note about what it cached, so a timing is never read without knowing whether the cache worked. */
  cache: string | null;
  cacheMB: number | null;
  heapMB: number | null;
  tiers: string;
};

const percentile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
const round = (n: number, digits = 2) => +n.toFixed(digits);

type Memory = { usedJSHeapSize: number };
const heapBytes = (): number | null => {
  const memory = (performance as Performance & { memory?: Memory }).memory;
  return memory ? memory.usedJSHeapSize : null;
};

const yieldToBrowser = () => new Promise(resolve => setTimeout(resolve, 0));
const settle = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runCase(backend: Backend, scenario: Scenario, host: HTMLElement, dpr: number): Promise<Result> {
  const fish = buildScene(scenario);
  await backend.init(host, scenario.width, scenario.height, dpr);

  let time = 0;
  const warmupStart = performance.now();
  for (let i = 0; i < WARMUP_FRAMES; i++) {
    stepScene(fish);
    time += 1 / 60;
    backend.frame(fish, scenario.width, scenario.height, time);
    backend.flush();
    if (i % CHUNK === CHUNK - 1) await yieldToBrowser();
  }
  const warmupS = (performance.now() - warmupStart) / 1000;

  // Sampled after warm-up, so one-off cache fills are attributed to setup rather than to the measured frames.
  const heapBefore = heapBytes();
  const samples: number[] = [];
  for (let i = 0; i < MEASURED_FRAMES; i++) {
    stepScene(fish);
    time += 1 / 60;
    const start = performance.now();
    backend.frame(fish, scenario.width, scenario.height, time);
    backend.flush();
    samples.push(performance.now() - start);
    if (i % CHUNK === CHUNK - 1) await yieldToBrowser();
  }
  const heapAfter = heapBytes();
  const cacheBytes = backend.cacheBytes();
  const cache = backend.stats?.() ?? null;
  backend.destroy();

  samples.sort((a, b) => a - b);
  const median = percentile(samples, 0.5);
  const mix = tierMix(fish, scenario.width, dpr);
  return {
    scenario: scenario.label,
    backend: backend.label,
    p50: round(median), p95: round(percentile(samples, 0.95)), max: round(samples[samples.length - 1]),
    fps: round(1000 / median, 1),
    perFish: round(median / scenario.count, 3),
    warmupS: round(warmupS, 1),
    cache,
    cacheMB: cacheBytes === null ? null : round(cacheBytes / 1024 / 1024),
    heapMB: heapBefore === null || heapAfter === null ? null : round((heapAfter - heapBefore) / 1024 / 1024),
    tiers: `${mix.full}/${mix.sprite}`,
  };
}

const HEAD = ['Scenario', 'Backend', 'Tiers f/s', 'p50 ms', 'p95 ms', 'max ms', 'FPS', 'ms/fish', 'Warm-up s', 'Cache MB', 'Heap Δ MB', 'Cache detail'];

function markdown(results: Result[], dpr: number): string {
  return [
    `Device pixel ratio ${dpr}; warm-up ${WARMUP_FRAMES} frames, measured ${MEASURED_FRAMES} frames per case.`,
    `Each frame is drawn and flushed to completion; timings are not capped by the display refresh rate.`,
    `User agent: ${navigator.userAgent}`,
    '',
    `| ${HEAD.join(' | ')} |`,
    `|${HEAD.map((_, i) => (i < 3 ? '---' : '---:')).join('|')}|`,
    ...results.map(r => `| ${r.scenario} | ${r.backend} | ${r.tiers} | ${r.p50} | ${r.p95} | ${r.max} | ${r.fps} | ${r.perFish} | ${r.warmupS} | ${r.cacheMB ?? '—'} | ${r.heapMB ?? '—'} | ${r.cache ?? '—'} |`),
  ].join('\n');
}

function render(results: Result[], dpr: number, status: string) {
  document.getElementById('results')!.innerHTML =
    `<tr>${HEAD.map(h => `<th>${h}</th>`).join('')}</tr>` +
    results.map(r => `<tr><td>${r.scenario}</td><td>${r.backend}</td><td>${r.tiers}</td>
      <td>${r.p50}</td><td>${r.p95}</td><td>${r.max}</td><td>${r.fps}</td><td>${r.perFish}</td>
      <td>${r.warmupS}</td><td>${r.cacheMB ?? '—'}</td><td>${r.heapMB ?? '—'}</td><td>${r.cache ?? '—'}</td></tr>`).join('');
  document.getElementById('status')!.textContent = status;
  (document.getElementById('markdown') as HTMLTextAreaElement).value = markdown(results, dpr);
}

/** Exposed so the run can be driven and read back without clicking, and so a headless driver can await it. */
declare global {
  interface Window {
    fs701?: { results: Result[]; done: boolean; error: string | null; markdown: string };
    /** Draw one backend's scene and leave it on screen, so what a timing measured can be looked at. */
    fs701preview?: (backendId: string, scenarioId: string, frames?: number) => Promise<string>;
    /** Measure what each tier actually changes on screen, at a ladder of sizes. */
    fs701calibrate?: (samples?: number) => unknown;
  }
}

/**
 * Draw a scene with one backend and leave the canvas up.
 *
 * A renderer comparison is only meaningful if every backend drew the same thing; this is how that gets checked rather
 * than assumed.
 */
async function preview(backendId: string, scenarioId: string, frames = 30): Promise<string> {
  const backend = BACKENDS.find(b => b.id === backendId);
  const scenario = SCENARIOS.find(s => s.id === scenarioId);
  if (!backend || !scenario) return `unknown backend or scenario: ${backendId} / ${scenarioId}`;
  const host = document.getElementById('stage')!;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const fish = buildScene(scenario);
  await backend.init(host, scenario.width, scenario.height, dpr);
  let time = 0;
  for (let i = 0; i < frames; i++) {
    stepScene(fish);
    time += 1 / 60;
    backend.frame(fish, scenario.width, scenario.height, time);
    backend.flush();
  }
  document.getElementById('status')!.textContent = `Preview: ${scenario.label} · ${backend.label} — ${backend.stats?.() ?? 'no cache'}`;
  return `${backend.label} drew ${scenario.label}; ${backend.stats?.() ?? 'no cache'}`;
}
window.fs701preview = preview;

async function runAll() {
  const button = document.getElementById('run') as HTMLButtonElement;
  button.disabled = true;
  const host = document.getElementById('stage')!;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const results: Result[] = [];
  window.fs701 = { results, done: false, error: null, markdown: '' };
  try {
    for (const scenario of SCENARIOS) {
      for (const backend of BACKENDS) {
        render(results, dpr, `Running ${scenario.label} · ${backend.label}…`);
        // A pause between cases lets the previous backend's GPU resources and garbage go before the next one is timed.
        await settle(200);
        results.push(await runCase(backend, scenario, host, dpr));
        render(results, dpr, `Running ${scenario.label} · ${backend.label}…`);
      }
    }
    render(results, dpr, `Done. ${results.length} cases.`);
  } catch (error) {
    const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
    window.fs701.error = message;
    document.getElementById('status')!.textContent = `Failed: ${message}`;
  } finally {
    window.fs701.markdown = markdown(results, dpr);
    window.fs701.done = true;
    button.disabled = false;
  }
}

document.getElementById('run')!.addEventListener('click', () => { void runAll(); });
document.getElementById('notes')!.innerHTML = [
  ...SCENARIOS.map(s => `<li><b>${s.label}</b> — ${s.intent}</li>`),
  ...BACKENDS.map(b => `<li><b>${b.label}</b> — ${b.note}</li>`),
].join('');

import { bodyLengthRange, calibrate } from './calibrate';
window.fs701calibrate = (samples = 12) => ({
  dpr: Math.min(window.devicePixelRatio || 1, 1.5),
  bodyLengths: {
    'dpr1 @1280': bodyLengthRange(1280, 1),
    'dpr1.5 @1280': bodyLengthRange(1280, 1.5),
    'dpr2 @1280': bodyLengthRange(1280, 2),
    'dpr1 @720': bodyLengthRange(720, 1),
  },
  rows: calibrate(samples),
});
