# M2 runtime and recovery

**Recorded:** 13 September 2026  
**Status:** FS-201/203/204 pushed as `bd175ed`; FS-202/205/206 reviewed, fixed and re-verified, awaiting push  
**Models:** genome v1 · development v2 · anatomy v2 · renderer v3 · runtime v1 · save schema v2 · motion protocol v1

## Delivered behavior

FS-202 moves fixed-step aquarium steering into a module worker. The UI sends fish snapshots, pause/speed and feed signals. Frames contain a stable entity ID order plus transferred x/y/vx/vy `Float32` values. Canvas renders from refs, so 20 Hz motion does not update React state. Fish that join the visible tank receive an actor on the next frame, so they are drawn and pickable at once. Playback pauses while the page is hidden. Unmount, Research-view navigation and tank switches terminate their previous worker. The client attempts one automatic restart, then shows a manual restart after another fault.

FS-205 persists one integer 50 ms clock. The app advances it at every command and every five minutes while idle (ADR-031). `advanceRuntime` advances every owned tank through the same pure integration boundary, whether visible or background. `timelineSegments` divides future model work at exact scheduled ticks and bounded step sizes. Reload converts real elapsed time at normal 1×, clamps a backwards clock to zero and applies at most eight hours. The lab has no age, water, health or resource state yet, so catch-up changes time only and says that life-history effects are inactive.

FS-206 holds a Web Locks single-writer lease. A second tab is visibly read-only and its domain commands cannot commit. After the writer closes, reloading the reader takes control without applying its draft. Browsers without Web Locks still use IndexedDB compare-and-swap tokens. Worker faults, quota failures and stale writers have visible recovery actions; unreadable data and valid backups remain preserved.

## Verification

`npm run check` passed 62 tests, strict TypeScript and the production build. `scripts/verify-runtime.cjs` ran in Google Chrome 153.0.8010.36 through bundled Playwright against the local Vite server.

| Check | Result |
|---|---|
| StrictMode plus three Research/aquarium remounts | 8 workers created, 7 terminated, exactly 1 active |
| Fault recovery | First fault restarted automatically; second exposed a paused warning; manual restart recovered |
| Synthetic motion load | 200 fish × 100 steps in 89.9 ms in the worker |
| UI responsiveness during load | Scheduled main-thread click delay 1.9 ms (acceptance target below 100 ms) |
| Shared integration | Fine one-tick steps and coarse/background steps agreed exactly at tick 10,000 |
| Event boundaries | Exact boundaries, no gaps/overlap; total integrated ticks unchanged |
| Offline cap | Nine-hour absence applied 576,000 ticks = exactly eight hours at 20 Hz |
| Backwards clock | Timestamp one hour in the future applied zero ticks |
| Multi-tab | Second tab read-only; writer close + reader reload transferred control; reader draft absent |
| Browser errors | None |

The 200-fish measurement is a deterministic synthetic workload on one machine, not a production rendering guarantee. It exercises the current all-pairs steering cost in a worker; the visible lab remains capped at 60 fish per tank. Main-thread Canvas paint, save serialization/validation, spatial hashing and render interpolation remain later performance work.

## Review fixes and re-verification

A review before push found three problems, each now fixed:

| Problem | Evidence | Fix |
|---|---|---|
| Fish bred, moved or bought into the visible tank were neither drawn nor pickable | Breeding 20 into the visible Breeding Studio: count tag 40, canvas still 20 | The canvas creates an actor for each new worker entity. Breeding again showed 60 fish without a reload and outlined the selected new fry |
| Hidden pages kept stepping motion | The worker port had dropped the earlier `document.hidden` pause | Playback pauses on `visibilitychange`: 21 → 0 → 20 frames per second |
| 30-second clock checkpoints stalled large worlds | 10,000 records: 48 ms to serialize and 412–490 ms per validation, with three validations per commit | Idle checkpoints every five minutes; commands still save at once |

The runtime journeys were then repeated in the in-app Chromium 152 pane, because Playwright was unavailable:

- Three StrictMode remounts created 6 workers and terminated 6.
- Automatic and manual fault recovery both worked.
- A second tab was read-only and its rename was refused; after the writer closed, takeover succeeded without the draft.
- Offline catch-up applied 576,000 ticks for nine hours, 54,001 for 45 minutes and 0 for a future timestamp.

`npm run check` passed 63 tests and the build. No console errors were recorded.

## Gate and next work

The M2 gate passes for versioned reload/replay, worker cleanup/recovery and active/background/offline clock parity. It does not claim biological active/offline parity because M3 has not defined water, physiology or development accumulators. Physical power-loss recovery and Firefox/WebKit coverage remain FS-703 work.

The next bounded task is FS-301: define unit-aware water/oxygen/waste state and conservation fixtures, then connect that state to the existing shared integrator. Growth, hunger, health and death must remain inactive until their own M3 contracts are implemented.
