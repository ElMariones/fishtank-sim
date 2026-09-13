const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const url = process.env.FISHTANK_URL || 'http://127.0.0.1:5173';
fs.mkdirSync('.artifacts', { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const evidence = { browser: browser.version() };
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      const NativeWorker = window.Worker;
      window.__workerStats = { created: 0, terminated: 0 };
      window.Worker = class TrackingWorker extends NativeWorker {
        constructor(...args) { super(...args); window.__workerStats.created++; }
        terminate() { window.__workerStats.terminated++; return super.terminate(); }
      };
    });
    const first = await context.newPage(), errors = [];
    first.on('pageerror', error => errors.push(error.message));
    await first.goto(url);
    await first.getByText('Saved on this device', { exact: true }).waitFor();
    await first.waitForTimeout(200);
    let stats = await first.evaluate(() => window.__workerStats);
    assert.equal(stats.created - stats.terminated, 1);

    for (let i = 0; i < 3; i++) {
      await first.getByRole('button', { name: 'Research', exact: true }).click();
      await first.getByRole('button', { name: 'Return to aquarium', exact: true }).click();
      await first.waitForTimeout(100);
      stats = await first.evaluate(() => window.__workerStats);
      assert.equal(stats.created - stats.terminated, 1);
    }
    evidence.lifecycle = { ...stats, active: stats.created - stats.terminated, strictModeAndRemounts: 3 };

    await first.evaluate(() => window.dispatchEvent(new Event('fishtank:simulate-worker-fault')));
    await first.getByText('Aquarium motion recovered.', { exact: true }).waitFor();
    await first.evaluate(() => window.dispatchEvent(new Event('fishtank:simulate-worker-fault')));
    await first.getByText(/Aquarium motion is paused/).waitFor();
    await first.getByRole('button', { name: 'Restart aquarium motion' }).click();
    await first.getByText('Aquarium motion recovered.', { exact: true }).waitFor();
    evidence.faultRecovery = 'One automatic restart, visible terminal fault, and manual restart all succeeded.';

    const benchmark = await first.evaluate(async () => {
      const { createWorld } = await import('/src/core/world.ts');
      const base = createWorld('2026-09-13T12:00:00.000Z').fish[0];
      const fish = Array.from({ length: 200 }, (_, index) => ({ ...structuredClone(base), id: `FSH-${String(index + 1).padStart(6, '0')}` }));
      const worker = new Worker('/src/simulation/motionWorker.ts', { type: 'module' });
      const ready = new Promise(resolve => worker.addEventListener('message', event => { if (event.data.type === 'ready') resolve(); }, { once: true }));
      worker.postMessage({ type: 'initialize', protocol: 1, fish, tick: 0, speed: 0 });
      await ready;
      let clickAt = 0, scheduledAt = performance.now();
      const button = document.createElement('button'); button.onclick = () => { clickAt = performance.now(); }; document.body.append(button);
      const clicked = new Promise(resolve => setTimeout(() => { button.click(); resolve(); }, 10));
      const result = new Promise(resolve => worker.addEventListener('message', event => { if (event.data.type === 'benchmark') resolve(event.data); }));
      worker.postMessage({ type: 'benchmark', protocol: 1, requestId: '200-fish', steps: 100 });
      const [measurement] = await Promise.all([result, clicked]);
      worker.postMessage({ type: 'shutdown', protocol: 1 }); worker.terminate(); button.remove();
      return { ...measurement, inputDelayMs: clickAt - scheduledAt - 10 };
    });
    assert.equal(benchmark.fish, 200); assert.equal(benchmark.steps, 100); assert.ok(benchmark.inputDelayMs < 100);
    evidence.benchmark = benchmark;

    const second = await context.newPage();
    await second.goto(url);
    await second.getByText(/Read-only: another tab controls this world/).waitFor();
    await second.getByLabel('Given name').fill('Blocked second writer');
    await second.getByRole('button', { name: 'Save', exact: true }).click();
    await second.getByText(/This tab is read-only/).waitFor();
    await second.getByRole('button', { name: 'Saves', exact: true }).click();
    await second.getByText(/holds the writer lock/).waitFor();
    await first.close();
    await second.getByRole('button', { name: 'Reload and try to take control' }).click();
    await second.getByText('Saved on this device', { exact: true }).waitFor();
    assert.notEqual(await second.getByLabel('Given name').inputValue(), 'Blocked second writer');
    evidence.writerLease = 'Second tab was read-only; after the first closed and reload completed, it became the writer without applying its draft.';

    const beforeOffline = await second.evaluate(async () => {
      const { openDatabase, readSlots } = await import('/src/persistence/database.ts');
      const database = await openDatabase(), slots = await readSlots(database);
      const current = slots.current; current.savedAt = new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString();
      await new Promise((resolve, reject) => { const tx = database.transaction('snapshots', 'readwrite'); tx.objectStore('snapshots').put(current, 'current'); tx.oncomplete = resolve; tx.onabort = reject; });
      const tick = JSON.parse(current.raw).tick; database.close(); return tick;
    });
    await second.close();
    const offline = await context.newPage(); await offline.goto(url);
    await offline.getByText(/8 hours of protected research time restored; the eight-hour offline cap was reached/).waitFor();
    await offline.getByText('Saved on this device', { exact: true }).waitFor();
    const afterOffline = await offline.evaluate(async () => {
      const { openDatabase, readSlots } = await import('/src/persistence/database.ts'); const database = await openDatabase();
      const slots = await readSlots(database); database.close(); return JSON.parse(slots.current.raw).tick;
    });
    assert.equal(afterOffline - beforeOffline, 8 * 60 * 60 * 20);
    evidence.offline = { appliedTicks: afterOffline - beforeOffline, capHours: 8 };

    await offline.evaluate(async () => {
      const { openDatabase, readSlots } = await import('/src/persistence/database.ts'); const database = await openDatabase(), slots = await readSlots(database);
      const current = slots.current; current.savedAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await new Promise((resolve, reject) => { const tx = database.transaction('snapshots', 'readwrite'); tx.objectStore('snapshots').put(current, 'current'); tx.oncomplete = resolve; tx.onabort = reject; }); database.close();
    });
    const futureTick = afterOffline;
    await offline.close();
    const backwards = await context.newPage(); await backwards.goto(url); await backwards.getByText('Saved on this device', { exact: true }).waitFor();
    const backwardsTick = await backwards.evaluate(async () => {
      const { openDatabase, readSlots } = await import('/src/persistence/database.ts'); const database = await openDatabase(); const slots = await readSlots(database); database.close(); return JSON.parse(slots.current.raw).tick;
    });
    assert.equal(backwardsTick, futureTick);
    evidence.negativeClock = 'A saved timestamp one hour in the future applied zero ticks.';
    assert.deepEqual(errors, []);
    evidence.pageErrors = errors;
    await backwards.screenshot({ path: '.artifacts/m2-runtime.png', fullPage: false });
    fs.writeFileSync('.artifacts/m2-runtime-evidence.json', JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
