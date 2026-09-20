# FS-701 — Canvas versus PixiJS, and the renderer cache/LOD decision

**Date:** 20 September 2026. **Status:** DONE, pushed `abf16d5`. No renderer change shipped.
**Models:** world save v14 · genome v3 · anatomy v3 · axolotl anatomy v2 · renderer v7. No save, command, genome or visual change.

## Starting state

`88271bb` (README rewrite) was HEAD and equal to `origin/main`. Baseline suite: 289 tests in 45 files, with one load-dependent timeout in `tests/economy.test.ts` (noted under FS-121 and fixed here).

## Scope

FS-701 asks for a Canvas versus PixiJS spike and the chosen renderer cache/LOD, with device, frame timings and memory recorded. It is the first task of M7, whose gate is performance and stability on a real device.

## What was built to measure it

Nothing in `src/ui` or the live render loop changed. The spike adds:

- `src/rendering/lod.ts` — pure tier selection and flipbook bucket arithmetic.
- `src/rendering/spriteCache.ts` — an LRU flipbook cache over a byte budget, plus `rasterizeFish`, so a Canvas backend and a GPU backend can draw **the same pixels**.
- `src/bench/{scene,backends,calibrate,main}.ts` + `bench.html` — the measuring page, served at `/bench.html` in dev.
- `tests/support/recordingContext.ts` + `tests/lod.test.ts` — a counting stand-in for `CanvasRenderingContext2D`, so draw-work claims are checked on every machine, not just this one.

`drawFish` and `drawAxolotl` gained an optional trailing `detail` argument defaulting to `FULL_DETAIL`. Every existing caller is unchanged, and a test asserts the emitted draw-op stream is identical to renderer v7 for all 83 visual fixtures.

**PixiJS is a devDependency and reaches no shipped bundle.** `npm run build` builds `index.html` only; `bench.html` is not built, and `grep -rl pixi dist/` finds nothing.

## Device

| | |
|---|---|
| Machine | Windows 11 Home 10.0.26200, x64 |
| Browser | Chrome 152.0.7977.76 (Claude desktop browser pane) |
| Node / npm | 22.18.0 / 10.9.3 |
| Canvas | 1280 × 720 CSS, device pixel ratio **1** |
| PixiJS | 8.21.0, WebGL preference |

One device, one pixel ratio. This is not a cross-device baseline; FS-704 owns that.

## Method

Each frame is drawn and then **flushed to completion** — `getImageData(0,0,1,1)` for Canvas, `readPixels` + `finish()` for WebGL — inside a plain loop.

`requestAnimationFrame` was rejected as the clock for two measured reasons: it is capped at the display refresh rate, so two backends that both fit inside 16.7 ms both report "60 fps" and the comparison says nothing; and it is suspended outright when the window is not painting, which is how this session's browser pane runs. Without the flush, a timing measures how fast a backend can *describe* a frame, which would have flattered the GPU path by exactly the amount being decided on.

Warm-up is **700 frames** per case. This matters more than it looks: every fish is genetically unique, so no two share a cached frame, and a 200-fish scene needs about 200 × 12 phases × 2 effort steps of frames before its cache is warm. The first run of this spike used 40 warm-up frames, measured the cache *filling*, and read as "caching does not help" — see [Corrections](#corrections-made-during-the-spike).

Scenes are seeded and stepped by a fixed timestep, so every backend draws the same fish in the same places. Fish sizes come from the live tank's own `fishPose` formula.

## Result 1 — comfortable at the tanks players use, tight at the maximum one

Warm-up 700 frames, 150 measured frames, flush-forced. `f/s` is the fish count at full versus sprite tier.

| Scenario | Backend | f/s | p50 ms | p95 ms | max ms | ms/fish | Warm-up s | Cache MB |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Tank, 12 adults | Canvas 2D, full detail | 12/0 | **2.9** | 4.8 | 9.2 | 0.242 | 3.0 | — |
| Tank, 12 adults | Canvas 2D, sprite cache | 12/0 | 3.8 | 6.4 | 8.5 | 0.317 | 2.9 | 0 |
| Tank, 12 adults | PixiJS, batched sprites | 12/0 | **0.3** | 2.0 | 3.1 | 0.025 | 1.1 | 4.51 |
| Tank, 12 adults | PixiJS, per-frame vectors | 12/0 | 3.3 | 8.0 | 12.6 | 0.275 | 5.2 | — |
| Crowded, 60 mixed | Canvas 2D, full detail | 42/18 | **19.0** | 28.3 | 41.8 | 0.317 | 12.8 | — |
| Crowded, 60 mixed | Canvas 2D, sprite cache | 42/18 | 15.3 | 25.9 | 36.8 | 0.255 | 17.6 | 1.13 |
| Crowded, 60 mixed | PixiJS, batched sprites | 42/18 | **0.5** | 2.0 | 2.7 | 0.008 | 1.8 | 15.27 |
| Crowded, 60 mixed | PixiJS, per-frame vectors | 42/18 | 22.5 | 38.9 | 48.0 | 0.375 | 17.6 | — |
| Fry swarm, 200 | Canvas 2D, full detail | 8/192 | **39.0** | 55.1 | 76.8 | 0.195 | 30.8 | — |
| Fry swarm, 200 | Canvas 2D, sprite cache | 8/192 | 38.4 | 58.9 | 187.5 | 0.192 | 26.7 | 11.73 |
| Fry swarm, 200 | PixiJS, batched sprites | 8/192 | **0.9** | 2.7 | 3.3 | 0.005 | 3.4 | 12.90 |
| Fry swarm, 200 | PixiJS, per-frame vectors | 8/192 | 63.1 | 91.1 | 104.7 | 0.316 | 46.5 | — |

**Canvas 2D costs about 0.25–0.32 ms per fish, roughly linearly.** A 16.7 ms frame has room for about 50 fish before the aquascape, plants, caustics and glass are drawn at all.

`world.ts` caps an upgraded aquarium at **60 places**, so the "Crowded, 60 mixed" row is not a stress test: it is the largest tank the game sells, reachable after two paid upgrades and then filling it. The shipped renderer takes **19.0 ms a frame** to draw it on this device at device pixel ratio 1.

Kept in proportion: that is roughly **53 fps for the fish layer**, a modest shortfall rather than a stutter, and it is the extreme of the current design. The tank a player actually looks at most of the time is the 12-adult case, at **2.9 ms**. A higher-density display would multiply the fill cost, and a faster GPU would not help, because this is CPU-side rasterization.

M7's gate is "alpha acceptance matrix passes on named hardware". **No target hardware and no acceptance matrix are defined yet** — both are still open in GDD §15 and HANDOFF §8 — so this measurement does not pass or fail that gate. It is the first number to put into it. FS-704 should set the matrix and re-run `/bench.html` per device; the decision below stands until it does.

## Result 2 — there is almost no "detail" to shed

The spike began from the assumption that small fish could drop fine detail. That assumption is wrong, and the measurement says so clearly.

`src/bench/calibrate.ts` renders each fixture twice — full detail, and with one feature removed — and compares the images. Worst case over 14 fixtures; *mean* is the mean per-channel difference (0–255) over the fish's own pixels.

| dropped | 16px | 44px | 96px | 192px | shape |
|---|---:|---:|---:|---:|---|
| marking glow | 13.2 | 17.0 | 19.1 | 20.4 | flat and large at every size |
| fin rays | 13.7 | 11.1 | 6.6 | 3.7 | **worst when small** |
| shimmer sparkles | 1.3 | 2.4 | 3.0 | 3.2 | grows with size |
| stipple | 0.4 | 0.5 | 0.6 | 0.6 | negligible |

Dropping the marking gradient moves **59–66% of the fish's pixels** at every size. It never fades, because it is a proportional shading effect, not a pixel-sized ornament. Fin rays go the *opposite* way from the usual LOD intuition: their stroke width is absolute while the fish around them shrinks, so they matter most at exactly the sizes a nursery is full of.

Two of those four are heritable traits made visible — a marking's soft edge and a shimmering skin — and a third is the cue that reads as a fin. A tier that dropped them would hide genetics at small sizes, which is the opposite of this project's stated promise. **The reduced tier was therefore removed from the design, not tuned.**

What survives is a cache, not a quality setting: below `SPRITE_DETAIL_PX` (44 device px) a fish would be drawn from a flipbook frame rasterized at *full* detail. Its only loss is the clock-driven shimmer sparkles, which a frame reused across moments cannot animate — measured at mean 1.3–2.4 over the sizes where it applies, the smallest of the four.

Fish sizes the live tank actually produces, for anyone re-reading these thresholds:

| | adult min | adult p50 | adult max | fry p50 |
|---|---:|---:|---:|---:|
| dpr 1 @ 1280 | 57.0 | 85.3 | 140.0 | 21.3 |
| dpr 1.5 @ 1280 | 85.6 | 127.9 | 210.0 | 32.0 |
| dpr 2 @ 1280 | 114.1 | 170.5 | 280.0 | 42.6 |

An earlier draft put the full-detail threshold at 96 px. At dpr 1 that would have demoted the median adult, changing the normal tank's appearance — caught by this table, not by inspection.

## Result 3 — the Canvas sprite cache does not pay for itself

Warm, paired, back-to-back on `fry-200` (99% hit rate, 2004 frames, 11.73 MB, zero evictions):

| | p50 ms | p95 ms |
|---|---:|---:|
| Canvas 2D, sprite cache | 41.9 | 71.2 |
| Canvas 2D, full detail | 44.0 | 61.8 |

**About 5%**, for 11.7 MB of cached frames, a 27-second warm-up, and a worse tail (187.5 ms max in the suite run). At the 60-fish tank it is better — 15.3 ms against 19.0 ms, about 20% — but still nowhere near a frame budget.

The reason is that the expensive per-frame work is already cached. `drawFish` keeps ornament `Path2D`s, palettes and marking placements per phenotype, so a steady-state frame re-issues only the geometry that actually moves. Measured with the counting context over 83 fixtures at a 120 px body length, caches warm, per fish per frame:

| tier | total ops | segments | fills | strokes | clips | gradients |
|---|---:|---:|---:|---:|---:|---:|
| full (every frame) | 316.5 | 246.9 | 44.7 | 16.0 | 2.2 | 2.9 |
| sprite (once, then blitted) | 316.4 | 246.9 | 44.6 | 16.0 | 2.2 | 2.9 |

The two rows are deliberately near-identical: a sprite frame draws *the same thing*, just once instead of every frame. Replacing 316 operations with one `drawImage` still only bought 5%, which says the cost is not in issuing the operations but in Canvas 2D compositing 200 alpha-blended, rotated, scaled images — work `drawImage` does not avoid.

## Result 4 — PixiJS is 20–40× faster, drawing the same pixels

The PixiJS sprite backend takes its textures from the same `rasterizeFish` the Canvas cache uses, so the images are identical by construction. Verified rather than assumed: over `fry-200`, non-transparent pixel counts were Canvas sprite cache **80 919**, Canvas full detail **72 945**, PixiJS sprites **81 222** — the two sprite paths agree closely, and the vector path differs only by frame padding and antialiased edges.

| scenario | Canvas 2D full | PixiJS sprites | factor |
|---|---:|---:|---:|
| Tank, 12 | 2.9 ms | 0.3 ms | 9.7× |
| Crowded, 60 | 19.0 ms | 0.5 ms | 38× |
| Fry, 200 | 39.0 ms | 0.9 ms | 43× |

The gain is batching: the GPU draws every sprite in a handful of calls. It is **not** free of the flipbook's costs — PixiJS pays the same rasterization, the same 12.9 MB, the same 3.4 s warm-up, and inherits the same absent sparkles.

PixiJS drawing vectors per frame (`pixi-graphics`) is *slower* than Canvas 2D at scale — 63.1 ms against 39.0 ms at 200 fish — despite drawing strictly less (body, tail and two fins, with no markings, ornament, gradients or stipple). Rebuilding GPU geometry every frame is not the win; batching pre-rasterized images is.

## Decision

**Stay on Canvas 2D for now. Ship no renderer change. Do not ship the sprite cache.**

- At the tank sizes players actually reach today, Canvas 2D is adequate: 2.9 ms for a 12-fish tank.
- The sprite cache returns 5–20% for 12 MB, a long warm-up and a worse tail. It is not worth the memory or the complexity, and it would have shipped a visible loss (absent shimmer) for that.
- A LOD tier that drops detail cannot be built without hiding heritable traits. Recorded as measured and rejected.
- PixiJS is the proven answer **if and when tank sizes grow**, at 20–40× with identical pixels. It is a large change — the aquascape, decor, plants, caustics and glass are all Canvas 2D and would need porting or compositing — so it is not worth taking before something needs it.

The threshold for revisiting is concrete: **when a tank must hold more than about 50 fish at once, or when a target device measures above 16.7 ms on the 60-fish scene, port the fish layer to batched GPU sprites.** The bench page and the backends are kept so that is a measurement, not a rewrite-and-hope.

`FULL_DETAIL`/`SPRITE_DETAIL` and the `detail` argument stay in the renderer: they cost nothing at runtime, they are what makes the calibration harness possible, and FS-704 will need them to re-measure on other devices.

## Corrections made during the spike

Recorded because each one would have produced a confident wrong answer:

1. **40 warm-up frames measured the cache filling, not the steady state.** The caching backends looked no better than the baseline. Raised to 700 after the working-set arithmetic was done properly.
2. **One isolated early reading of 10.3 ms against 34.8 ms for the warm sprite cache did not reproduce.** A paired back-to-back re-run gave 41.9 ms against 44.0 ms. The 10.3 ms figure is not used anywhere above; the paired run is. Canvas 2D timings on this machine vary enough between sessions that only paired, back-to-back runs are quoted.
3. **A 96 px full-detail threshold would have demoted the median adult fish** at dpr 1. Found by measuring the body-length distribution the tank actually produces.
4. **The first tier design dropped the marking glow and fin rays**, which the image comparison showed changes ~60% of pixels at every size. Removed.
5. **`Math.min`/`Math.max` propagate NaN**, so a NaN arriving from the worker's `Float32Array` would have produced a `NaN` cache key and a frame rasterized from NaN geometry. The bucket helpers now send non-finite input to bucket 0, and `detailFor` sends it to full detail.

## Limitations

- **One device, one pixel ratio (1), one browser.** Higher-density displays multiply fill cost and are not covered. FS-704 owns the cross-browser and cross-device baseline.
- **The browser pane was hidden for the whole session**, so `requestAnimationFrame` was suspended and no live-app visual journey or screenshot could be taken. The flush-forced loop is unaffected by this, but the numbers are "cost to produce a frame", not observed in-app frame rates.
- **No axolotl is in the visual fixtures**, so the scene timings are koi-only. The axolotl renderer's tier handling is covered by a unit test against `DEFAULT_AXOLOTL_SHAPE`, not by the scene measurements.
- **The scene draws fish only.** The aquascape, plants, caustics, bubbles and glass are excluded, so the real frame is more expensive than every number here, and the ~50-fish ceiling is optimistic.
- **`pixi-graphics` is not a visual match** and draws strictly less than the shipped renderer; it is a cost probe and flatters PixiJS.
- Heap deltas from `performance.memory` are sampled and noisy — several are negative because a collection ran mid-case. The `Cache MB` column is exact byte accounting and should be used instead.

## Follow-ups

- **FS-702** should take the ~0.25 ms/fish figure and the 60-place cap as its starting point; a 2000-owned-fish soak will not be a rendering problem (only one tank draws) but the 60-fish tank already is.
- **FS-704** should re-run `/bench.html` on the target devices and pixel ratios and record the table per device.
- Untested candidate, measured but not pursued: the body outline is static per phenotype yet rebuilt every frame (roughly 80 of 247 path segments). Caching it as a unit-space `Path2D` and transforming with `addPath` would keep the output identical. It was not implemented because Result 3 shows segment count is not what costs the time.
