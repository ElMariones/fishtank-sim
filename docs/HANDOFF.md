# Handoff for the next developer or agent

## 1. Context

Latest work: **FS-701 renderer spike** (M7), DONE, pushed `abf16d5`. It ships no renderer change: the aquarium draws exactly as before, and `drawFish`/`drawAxolotl` only gained an optional trailing `detail` argument defaulting to full detail, with a test asserting an identical draw-op stream to renderer v7 across all 83 fixtures. Its finding is that **Canvas 2D costs ~0.25–0.32 ms per fish, so the 60-place aquarium already costs 19.0 ms a frame** on the measured device; M7's performance gate is open. A detail-dropping LOD tier and a full-detail sprite cache were both measured and rejected, and PixiJS (20–40× faster, identical pixels) is recorded as the escape hatch with a concrete trigger. See [FS-701 evidence](research/FS-701-RENDERER-SPIKE.md) and ADR-072. FS-702 is next. Previously: **FS-120 axolotl anatomy/locomotion overhaul**. `axolotlAnatomy.ts` is presentation version 2; `axolotlPose.ts` is the pure transient breathing/gill/limb/tail deformation layer. Behavior v3 adds an axolotl-only bottom bias and push/glide rhythm. Genome/expression/world versions are unchanged. The 286-test/build run and isolated browser journey pass; see [FS-120 testing](TESTING.md#fs-120-axolotl-anatomy-and-locomotion). Fine detail is scale-dependent; preserve the separate pigment-layout and contour RNG streams when adjusting LOD. M7 FS-701 remains the next roadmap task.

The user wants a web-based living fish simulator centered on genetics, behavior, environment, breeding, detailed inspection, permanent family trees, multiple decorated tanks, sales and a marketplace. They supplied a concept document and an empty GitHub repository.

This handoff provides the design and a runnable research prototype. The central intended progression is ordinary koi → selected variants → supported structural mutations → unusual stable lineages, with every individual’s ancestry inspectable.

The user explicitly allowed modifying the concept. Major adjustments are documented in GDD section 2: bounded cohorts/topology, honest rarity scope, separate diversity metrics, protected absence, bounded economy, and preserved visual versions.

## 2. Repository and environment

- Remote: https://github.com/ElMariones/fishtank-sim.git
- Local workspace used: C:/Users/mario/Desktop/PROYECTOS/Fishtank Sim
- Remote was empty when cloned. `main` now carries the initial lab and FS-101 baseline (`fe138d4`) and FS-102 anatomy anchors (`b0fd927`). Check `git log` for later M1 work.
- Verified with Node 24.11.1 / npm 11.6.2 (FS-101) and Node 22.18.0 / npm 10.9.3 (FS-102).
- npm cache is checkout-local through .npmrc.
- The `.git` directory may be owned by a different Windows account than the one running git. Pass `-c safe.directory=<checkout>` per command rather than changing global git configuration without the user’s consent.
- No external accounts, database, secrets, deployment or env file required.
- A local Vite session was started at http://127.0.0.1:5173; verify availability before starting a duplicate.

## 3. Read order

1. Root AGENTS.md and README.md.
2. IMPLEMENTATION_STATUS.md: distinguish working code from planned features.
3. GDD.md: user fantasy, scope, gameplay and concept adjustments.
4. GENETICS.md: stable locus order, phase, mutation semantics, phenotype/rarity rules.
5. ARCHITECTURE.md: current source map and future contracts.
6. ROADMAP.md + BACKLOG.md: pick a bounded task.
7. UX_SPEC.md / BALANCE.md / TESTING.md as the task requires.

Original notes are in source/original-concept.txt. Do not treat the original notes as overriding the user’s current instruction or the reconciled design.

## 4. Working code and important constraints

Genetics use 48 legacy loci, or 60 loci in genome v2, with two phased array copies. Indices matter. Genotype changes, expression changes, and renderer changes have different compatibility consequences; avoid silently changing the appearance of existing saved fish.

Mutations are 0.003 **per copy**. There are 96 transmitted copies, so about one quarter of lab births carry a small de novo mutation. This is a research setting.

Portraits offer Now (current stage) and Adult potential (genetic preview). Growth, longevity, metabolism and oxygen demand are integrated. Worker pellets are visual; persistent nutrition is integrated through the shared tank food pool. Habitat & expansion edits persistent permeable plant cover and solid rock footprints (FS-503). Body-center clearance is a visual proxy; extreme fins may overlap. Lab credits use bounded NPC buyers and a reconciled ledger; extra tanks and expansions are paid; breeding and food remain free.

Geometry lives in `src/core/anatomy.ts` (anatomy v2). The Canvas renderer draws it, portraits frame from its bounds, and the tank uses `src/rendering/tankLayout.ts` for both drawing and picking. Change anchors there and extend `tests/anatomy.test.ts`; do not add renderer-only geometry exceptions.

Genome v2 (FS-113) appends the Color and Ornament chromosomes; expression is in `src/core/appearance.ts` and ornament geometry in `src/core/ornament.ts`. Never rewrite stored genome v1 records: they read as the classic baseline. Keep v1 loci on the original random stream and research surfaces on genome v1. Breed and buy commands carry `genomeVersion`; journal entries without it must replay as genome v1, or existing saves fail validation.

World save v2 (FS-301) gives every tank water. Advance time only through `advanceRuntime`. Water integrates in fixed absolute 25-tick steps using basic arithmetic, so replayed and live values stay identical; keep new time-integrated state to the same rules. Any older world version rebases its checkpoint when loaded (ADR-038). Water slows growth through condition but does not harm fish.

World save v3 (FS-302) adds `life` to every fish: age in game days, current length and condition, updated once per absolute game-day boundary. Eggs cannot breed or be sold. Current size and genetic adult length are separate values; never substitute one for the other.

World save v4 (FS-305) adds `care` to every tank: feeder ration, thermostat and the current feeding day. Domain feeding is one shared food pool per tank inside `advanceWorld`; worker pellets remain visual. Condition is the health measure, and every factor in the environment must also appear in `environmentLimits`, so no decline is unexplained. Care previews advance a copy of the tank with the same rules; keep them equal to applying the change. Fish never die.

Stage appearance v1 (FS-306) lives in `src/core/juvenile.ts`: a pure function of the adult phenotype and saved life state. The tank and **Now** portraits draw it; the adult phenotype is the labeled genetic preview and what goals, planner previews and research surfaces use. Keep new visual development there, not in the renderer. Renderer v6 motion is optional and never grows a structure, so portrait framing and anatomy bounds hold.

FS-307 adds an optional `onDay` observer to `advanceWorld`, `advanceRuntime` and `applyOfflineCatchup`. Keep it purely observational: the absence summary and care scenarios depend on the observed advance being identical to the plain one. The summary's unexplained-decline count must stay zero; if a new environment factor is added, list it in `environmentLimits` too.

World save v5 (FS-401/402) adds `breeding.cooldownDays` to fish and `clutches` with `nextClutchId` to the world. A courting clutch reserves nursery places; every command that adds residents must count `reservedPlaces`, or a nursery can overflow at spawning. Courtship and spawning run in `advanceClutches` after development at each game-day boundary. Keep the instant `breed` command's behavior unchanged apart from reservations, because older journals replay through it. Migrations must write top-level and nested keys in schema order: replay validation compares serialized worlds, and a misordered key sends every older save to recovery mode.

The family view (FS-404) derives everything from parent IDs in `src/core/genealogy.ts` and adds no saved state. Keep views bounded: six generations each way, at most 126 ancestors. List a repeated ancestor once with its position count rather than duplicating nodes. `tests/genealogy.test.ts` compares the graph with an explicit position-by-position expansion; extend it when changing the walk. Pedigree F still comes from `pedigree.ts` over every recorded generation.

Kinship (FS-405) comes from one `createKinshipCache` instance in App state. Its validity rests on recorded parents and generations never changing; if a future feature edits ancestry, `sync` must see the change, which it detects and rebuilds from. Keep the one-off `kinship()` routed through the cache so existing reference tests keep covering it. Founders and unrecorded parent IDs follow the explicit `FounderAssumption`; a parent record missing from the world hides that line's relatedness, so surface missing parents rather than silently lowering F.

Batch rehoming (FS-406) is the `move-batch` command. Keep it atomic and reservation-aware, like `sell-batch`. Clutches within a parent pair are grouped by shared birth time (`birthGroupsOf`), so anything that changes how `bornAt` is assigned would split or merge clutches in the collection. `src/core/lifecycleScenario.ts` is M4's gate evidence: it must keep issuing no `breed` command and keep replaying its journal. Re-run it and check its day counts whenever breeding, growth or care constants change.

World save v6 (FS-501) adds `market` and `ledger`, plus the `rehomed` fish status. Every command that changes credits must write a ledger entry, because `decodeSave` rejects credits that differ from the opening balance plus the totals. Sales price through `planSales` in `src/core/economy.ts`, which the commands, reviews and E-05 share, so change pricing there, not in UI code. Sale commands carry `priceModel: 1`; commands without it are journal entries from before the economy and must keep the lab quote, or older saves stop replaying. Rehomed and sold fish are both archived, so check `status !== 'living'` rather than `status === 'sold'`.

World save v7 (FS-502) adds the persistent shop. Buy through `buy-listing`; retain legacy `buy` for journals/research. Runtime migration dates the first delivery from the saved game day. Listing IDs, genomes and prices are stable until purchase or expiry; never generate stock while rendering or opening the shop. See [shop evidence](research/FS-502-PERSISTENT-SHOP.md).

The live Canvas’s transient actors are outside React state. Motion is deterministic for the same initial actors and tick sequence, but positions are not persisted; switching tanks reconstructs visual trajectories. Birth/genome outcomes do persist.

Sales preserve the full fish record, including parent IDs and genome. The archive assumes sold fish are no longer locally living; online ownership/death states must be modeled separately later.

Save decoding must continue to reject invalid future schemas without overwriting stored data. Saves now supports v1/v2 import preview, explicit replacement and two-backup recovery. Preserve the IndexedDB compare-and-swap token and legacy raw data. Runtime schema v2 wraps world/genome v1; do not reset revision when compacting the replay journal.

### FS-503 contract

World v8 persists tank decorations. `purchase-tank`, `upgrade-tank` and `place-decorations` debit the equipment ledger atomically (the existing `afford` helper already deducts credits). Keep v7 shop stock, water and ledger checks during migration; omit only new decoration fields from its replay comparison. Legacy free tank/decorate commands remain for historical journals and research. Protocol 3 sends placed footprints and preserves them on worker restart. Layout validation prevents overlapping rock clearance regions and placement against the glass. See [FS-503 evidence](research/FS-503-HABITAT-EXPANSION.md). FS-505 must revisit E-05's free research tanks before claiming paid-economy balance.

### FS-504 contract

World v9 adds `relief`. `claim-relief` is the only way to receive free fish. It is allowed only while a sex has no living fish, credits are below ◈ 250 for each missing sex, and the 10-game-day wait has ended. It writes a ◈ 0 stock ledger entry.
- **Migrations:** every migration appends `relief` last. v8 replay compares whole worlds, and only v7 and older omit decorations.
- **Adding costs:** if a future feature adds a recurring cost, rerun `tests/recovery.test.ts`. Its walk and hard-start routes are the no-softlock evidence, and they assume a lineage with both sexes can always continue for free.
- **Care warnings:** keep a free or affordable fix on every warning, and never offer paid or legacy free tank commands as one-click fixes.
- **Guide:** progress (`GUIDE_KEY`) is device-local like collection preferences. Steps complete from player actions recorded in `App.tsx` (select, rename, feed, following a parent) or from `observedGuideSteps`, and **Show me** must never issue commands.
- **Family at a glance:** it counts full siblings and offspring in one pass; keep it bounded if records grow. See [FS-504 evidence](research/FS-504-ONBOARDING-AND-RECOVERY.md).

### FS-605 contract

- **Gate evidence:** `src/core/unusualLineScenario.ts` is M6's gate evidence. It must keep issuing no `breed` command and keep replaying its journal. Re-run `tests/unusualLine.test.ts` whenever mutation rates, founder weights, breeding or growth constants change, and update the pacing tables.
- **No hidden rerolls:** faster discovery must come from visible, declared levers (shop carriers, nurseries, a sandbox multiplier). See [FS-605 evidence](research/FS-605-UNUSUAL-LINE.md).

### FS-604 contract

- **Separate measures:** never merge `ancestryContributions` and `standardSimilarity` into one membership score, and label them separately wherever they appear.
- **Fixed standards:** a line's standard is captured once at registration; changing its rules needs a new model version.
- **Calibration:** `DESCRIPTOR_TOLERANCE` (0.30) comes from measured seeded pair distances. Re-measure it if descriptors or genetics ranges change. See [FS-604 evidence](research/FS-604-BLOODLINE-REGISTRY.md).

### FS-603 contract

- **Descent only:** origins pass only through the transmitted homolog. Every new birth path must call `inherit` with a trace and set `origins` with `childOrigins`; stock, shop and rescue fish start with `[]`.
- **Validation:** `decodeSave` refuses origins that disagree with recorded mutations or alleles. A future command that edits genomes would have to rewrite origins too.
- **Scope:** `mutationNotebook` counts are save-local. Never label them as population frequency or rarity. See [FS-603 evidence](research/FS-603-MUTATION-ORIGINS.md).

### FS-602 contract

- **Standard path:** a standard structure must build exactly anatomy v2. `tests/legacy/anatomyV2.ts` is a frozen copy; never edit it to make a test pass.
- **Lobes:** tail geometry is `caudal` plus `extraLobes`. Iterate `tailLobes(a)` and use `tailBox(a)` rather than reading only `caudal`, and handle `dorsal === null`.
- **Validation:** new structures need fixtures in `STRUCTURE_VISUAL_FIXTURES` built from registry-supported alleles, plus a pass through `structureSweep`. See [FS-602 evidence](research/FS-602-STRUCTURE-ANATOMY.md).

### FS-601 contract

- **Registry:** `src/core/registry.ts` is the one place for founder weights, mutation targets and rates, baselines and allele labels. A new chromosome appends to the registry, gets its own random streams and names a baseline for older genomes.
- **Frozen streams:** never route an existing chromosome through a different random-number sequence. `tests/registry.test.ts` compares genome v1/v2 births with a copy of the pre-registry code.
- **Original expression:** `expressStructure` returns the standard structure below genome v3. Renderer work for FS-602 must leave standard-structure anatomy identical.
- **Versions:** a clutch cannot downgrade its parents' genome version. The app sends `GENOME_VERSION` (3), and older journals keep their recorded versions.
- **World v10 shop:** `shop.model` 1 delivers genome v2 and model 2 genome v3. Only a runtime rebase or a bare import moves a world to model 2. See [FS-601 evidence](research/FS-601-REGISTRY-AND-GENOME-V3.md).

### FS-505 contract

- **Playtest harness:** `src/core/paidEconomy.ts` must keep sending only live-interface commands; it throws on `add-tank`, `decorate`, `buy` or `breed`. Its spending split is checked against the ledger, so a new credit-changing command needs a ledger reason and a place in `SourcesAndSinks`.
- **Recovery route:** `routeToPairing` in `src/core/playtest.ts` is the shared no-softlock probe for `tests/recovery.test.ts` and the playtest. Change it in one place.
- **Batch sales:** the interface reviews `planBestSales` and sends its order to `sell-batch`. The command still sells in the order sent, so journals replay unchanged. Keep the review and the command on the same plan.
- **Open balance risks:** there is no recurring sink after the eight-tank build-out, and premium equipment does not repay itself in healthy tanks. Adding a recurring cost means revisiting the rescue and rerunning both tests. See [FS-505 evidence](research/FS-505-PAID-ECONOMY-PLAYTEST.md).

### FS-117 contract

- **Catalog:** decoration item IDs and look option IDs are stored in saves and journals. Append new ones; never rename or remove one. A piece without `item` is an FS-503 piece and must keep its original radius (0.09 cover, 0.055 rock) and ◈ 25 price.
- **No style on creation:** `newTank` must not add `style`; older journals that buy tanks replay against snapshots without it. Absent style means `DEFAULT_STYLE`.
- **Cosmetic only:** looks and piece art must not feed water, development, behavior or prices. Only the footprint kind, position and radius reach steering.
- **Layout rules:** `layoutProblem` may only be relaxed without a version bump; tightening it would reject stored layouts. Themes are tested to stay valid.
- **Editing freeze (ADR-067):** while the editor is open, keep the game clock frozen (`frozenTick` in `App.tsx`) and the canvas on its dirty-flag paint path. Any new per-frame visual must mark the canvas dirty when it changes, or it will not show while frozen. Keep the draft out of App state: drag updates must not re-render the app.
- **Playtest harness:** `paidEconomy.ts` does not send `style-tank`; if it ever does, add the spend to its sources and sinks.

### FS-118 contract

- **One worker, one render loop:** `TankCanvas` must not key its worker or paint effects on the tank. Use `MotionWorkerClient.reset` for a switch, and keep `awaitingReady` so a previous tank's frames are never drawn.
- **Shared layers:** static layers are cached by content key (`base:` size/substrate/backdrop, `solids:` size/pieces). Anything new drawn into them must be part of that key.
- **Deferred collection:** grid-only derivations follow `collectionTankId`; the aquarium, heading and commands use the urgent `tank`. Portraits must stay memoized and keep painting through the queue.

### FS-701 contract

- **No quality tiers:** `detailFor` chooses between drawing vectors and drawing a cached frame. It must never be used to drop marks for speed: the marking gradient, fin rays and stipple are heritable traits made visible, and the measured image differences in the FS-701 report show dropping them is visible at every size. A new `Detail` flag needs a fresh calibration run, not a judgement call.
- **Sprite frames are full detail:** `SPRITE_DETAIL` differs from `FULL_DETAIL` only by `sparkle`, which is forced — a frame reused across moments cannot twinkle. Anything else turned off there changes stored fish's appearance.
- **Unchanged by default:** `drawFish`/`drawAxolotl` default `detail` to `FULL_DETAIL`, and `tests/lod.test.ts` compares the emitted draw-op stream with the no-argument call for all 83 fixtures. Keep that test passing, or the shipped appearance has moved.
- **Bucket helpers are NaN-safe:** motion arrives from the worker's `Float32Array`s. Non-finite input goes to bucket 0 and to full detail; a `NaN` bucket would key a cache entry on "NaN" and rasterize a frame from `NaN` geometry.
- **Measuring:** `/bench.html` is dev-only and never built. Measure with the flush-forced loop, not `requestAnimationFrame` (refresh-rate capped, and suspended when the window is not painting), warm caching backends for the whole flipbook (700 frames, not 40), and quote only paired back-to-back runs — Canvas 2D timings on Windows vary enough between sessions that unpaired numbers mislead. PixiJS stays a devDependency.

### FS-119 contract (world v14)

- **Axolotl shop:** buy through `buy-axolotl-listing`; keep the legacy `buy` with `species: 'axolotl'` for journals. Stock derives from the world seed and listing number under the `axolotl-shop` namespace; never generate it while rendering. `axolotlListingProblem` must accept every listing `makeAxolotlListing` can create, and prices must stay above the ◈ 150 founder resale cap.
- **Migration:** worlds v1–v13 gain a day-0 delivery in `decodeSave`; `decodeRuntime` omits `axolotlShop` when proving an older snapshot and then keeps its replayed stock.
- **Price model 2:** new sale commands carry `priceModel: 2`. Model 1 must keep pricing axolotls with koi thresholds, or recorded journals stop replaying. Koi prices must stay identical in both models.
- **Locus notes:** `KOI_LOCUS_NOTES` (`src/core/locusNotes.ts`) and `AXOLOTL_LOCUS_NOTES` (`axolotlCatalog.ts`) are typed records over every locus, so adding a locus without a note fails type-checking. Keep notes honest about loci the lab records but does not simulate.

## 5. Verification and task completion

Run npm test and npm run build after core/code changes. Browser verification should exercise the affected journey, not just inspect a screenshot. Read TESTING.md before broadening tests.

Meaningful existing tests include Mendelian 1:2:1 segregation, linkage probability, mutation boundary transitions, pedigree fixtures, command atomicity, save validation, artificial selection and anatomy attachment/framing sweeps. They do not prove art quality or realistic biology.

Update implementation status with changed behavior and limitations; update testing evidence with exact command/result/environment; change decision log if a contract or architecture choice moves. Avoid claiming a milestone gate passed just because tests are green. The user asked that backlog items be marked DONE only once their work is pushed.

## 6. Recommended next prompt

> M7 has started. FS-701's Canvas/PixiJS spike is DONE (`abf16d5`) and ships no renderer change; read [its evidence](research/FS-701-RENDERER-SPIKE.md) and ADR-072 before touching the renderer, because it records two designs measured and rejected and the trigger for adopting PixiJS. Next is **FS-702**: a 100-generation and 2000-owned-fish soak with no invalid records, leaks or duplicate events. Start it from FS-701's numbers — only one tank draws at a time, so 2000 owned fish is a simulation and persistence problem rather than a rendering one, while the 60-place tank is already over a 60 fps frame budget and belongs to FS-704's device baseline. Keep `/bench.html` working; FS-704 re-runs it per device. M3–M6 are DONE. M6: FS-601's locus registry and genome v3 Structure chromosome (`fb6b593`) FS-602's structure anatomy (`0e95249`) FS-603's mutation origins (`1d0d85c`) FS-604's bloodline registry (`d9f17c0`) and FS-605's koi-to-unusual-line demonstration with pacing review (`bb10985`) are DONE; see their reports. Next is M7 FS-701: a Canvas versus PixiJS spike and the chosen renderer cache/LOD, with device, frame timings and memory recorded. Carry the open balance risks (no recurring sink after build-out, slow tail-topology discovery) to FS-705. M5's task list is DONE: FS-501 economy model (`006b500`), FS-502 persistent shop (`3945d86`), FS-503 paid expansion and decorations (`f78d007`), FS-504 first-session guide and koi rescue (`6335851`), and FS-505 paid-economy playtest with best-first batch sales (`f5b1888`); see the FS-505 report. Keep sale commands carrying a price model, the ledger reconciled, a free or affordable fix on every care warning, and migrations writing keys in schema order.

## 7. Subsequent task briefs

**Rendering specialist, after FS-102:** implement FS-103 against frozen phenotype inputs and the anatomy v2 contract. Own pattern development and a fixture comparison view. Return paired seed images/measurements and intended visual differences. Do not alter inheritance of existing loci.

**Runtime specialist, after M1 gate:** implement FS-201/202 with protocol types agreed first. Own simulation and command/event timing. Preserve deterministic births, public command checks and renderer input contracts. Demonstrate worker cleanup and command retry behavior.

**Persistence specialist, after command contracts:** implement FS-203/204. Own storage adapters and migration/import validation. Preserve v1 backup, validate before overwrite, and demonstrate crash/future-schema recovery.

These are reusable briefs for later authorized work. No independent background agents have been launched by this handoff.

## 8. Design decisions still open

Business model, final art style/quality target, real-life versus fantastical anatomy limits, target benchmark hardware, sound assets, vendor/hosting choice, multiplayer priority and challenge-mode mortality. Working defaults are in GDD section 15. Most first-milestone work does not depend on resolving them.

## 9. Local review state

Browser QA generated a cohort, renamed FSH-000007 to Ember, moved her to Breeding Studio, and sold founder Haru to test archive preservation. This is only the browser’s device-local demo save. A new browser profile starts with the six founders; these QA actions are not hardcoded seed data.

Do not reset a user’s developing lineage as part of ordinary verification. Use isolated test worlds/fixtures for destructive or large-scale experiments.
