# Technical architecture and implementation strategy

**Version:** 0.1 · **Decision date:** 13 September 2026.

## 1. Current architecture

The repository is a small React + TypeScript + Vite application. It is deliberately a single package; splitting empty packages and deploying services would not validate the central idea.

```text
src/
  core/
    catalog.ts      Stable 48-locus ordering, lab constants and appearance model versions
    types.ts        Genome, fish, tank, world and phenotype contracts
    random.ts       Seeded PRNG, deterministic hash, clamping
    genetics.ts     Founder generation, meiosis, mutation, expression
    anatomy.ts      Anatomy v2: phenotype → body-space outline, anchors, bounds, validation, framing
    pattern.ts      Development v2 marking anchors from phased haplotype blocks; seeded placement in body coordinates
    patternResemblance.ts Standard-body marking masks, overlap/separation metrics and seeded family study
    appearance.ts   Genome v2 Color/Ornament expression, founder weights and founder-stock rarity descriptions
    ornament.ts     Development v3 motif, scale, sparkle and tail/dorsal pattern geometry in body-length units
    descriptors.ts  Fourteen visible descriptors normalized against development ranges
    collection.ts   Device-local collection preferences, goal ranking, sorting, cohorts and goal leaders
    selectionExperiment.ts Seeded ten-generation truncation selection vs random mating, with pedigree F and gate
    resemblanceStudy.ts Blind parent-pair trial set, display modes, computational observer and answer scoring
    resemblancePool.ts Strict validation and recomputation of anonymous human observer records
    pedigree.ts     Exact memoized ancestry-pair queries with an explicit stack
    world.ts        Validated world commands and local NPC transactions
    water.ts        Water model v1: one-compartment oxygen/ammonia/food chemistry, fixed steps, ledger and status bands
    habitat.ts      Resident load per tank, world advance (water steps plus daily development) and stocking bands
    development.ts  Life model v1: egg/fry/juvenile/adult/elderly stages, logistic growth, lagged condition and environment curves
    save.ts         Legacy world-v1 schema and reference validation
    runtime.ts      Versioned command envelope, integer tick, event IDs and checkpoint replay
    visualFixtures.ts Frozen FS-101 fixtures, anatomy stress cases and v1-vs-v2 anatomy sweep
  persistence/
    database.ts     IndexedDB current/two backups, transaction/read-back and stale-writer checks
    session.ts      Serialized commits, offline catch-up and legacy migration
    writerLease.ts  Web Locks single-writer lease; IndexedDB compare-and-swap remains fallback
  simulation/
    motion.ts       Pure 20 Hz steering step, independent of React/Canvas
    protocol.ts     Stable worker message and transferable frame layout
    motionWorker.ts Worker-owned fixed-step steering, playback, feed and benchmark
    motionClient.ts Lifecycle, cleanup, one automatic restart and manual recovery
    time.ts         Shared tick segments, event boundaries and protected offline window
  rendering/
    fish.ts         Canvas renderer v4: anatomy v2, markings, color palettes and cached ornament paths
    tankLayout.ts   Shared tank pose transform and fish-shaped picking
  ui/
    App.tsx         Lab controls, command runtime, inspector and paginated collection
    Startup.tsx     Validated async loading before interactive controls
    SavePanel.tsx   Export, import review, retry and backup recovery
    TankCanvas.tsx  Paints worker motion frames, fish picking and the motion-fault recovery notice
    FishPortrait.tsx Shared procedural renderer at portrait scale, fitted or shared-scale framing
    VisualFixtureLab.tsx Deterministic fixture, anatomy and marking-resemblance comparison surface
    ResearchLab.tsx Blind resemblance study and ten-generation selection experiment
    styles.css     Responsive theme and layout
  main.tsx         React entry
tests/
  core.test.ts     Genetics, pedigree, commands, saves, motion, FS-101 fixture pins
  anatomy.test.ts  Anatomy attachment sweep, framing without clipping, picking transform
  pattern.test.ts  Marking block derivation, transmission, placement jitter and resemblance thresholds
  collection.test.ts Preference validation, collection ordering, cohorts and goal leaders
  selection.test.ts Selection gate, diversity cost, speed tradeoff and determinism
  resemblanceStudy.test.ts Trial set, display modes, computational observer and result validation
  resemblancePool.test.ts Five-observer FS-111 pool, per-trial agreement and record validation
  appearance.test.ts Genome v2 stream isolation, dominance, founder rarity, mixed-version saves and ornament bounds
  water.test.ts    Zero/overload/recovery conservation fixtures, split-interval equality, habitat load, replay and world v1 migration
  development.test.ts Hatching, healthy maturity range, declared-condition fixtures, condition history, egg rules and world v2 migration
  limits.test.ts   Living/record limits, deep and wide pedigree queries and atomic rejection
  runtime.test.ts  Command envelopes, retries, replay, compaction, migration and tamper rejection
  time.test.ts     Tick segments, shared tank clocks, offline cap and backwards clocks
  motionClient.test.ts Worker start, one automatic restart, manual restart and cleanup
```

Core modules import neither React nor browser globals. The Canvas renderer receives a phenotype, seed, size and animation time; it obtains geometry from the pure anatomy module, so tests validate the same eye, fin and tail anchors that are drawn and the tank uses one pose transform for drawing and picking. Motion has its own actors and reads genetic movement parameters. The app owns persisted entities and selected UI state.

There is currently **no backend, WebGL mesh, biological life-stage scheduler, authentication, or online market**. The Web Worker handles visual motion; commands, save validation and the persistent clock remain separate pure/domain or persistence modules.

## 2. Stack decisions

| Concern | Current | Next target | Reason |
|---|---|---|---|
| UI and tooling | React, strict TypeScript, Vite | Retain | Browser simulation does not require server rendering |
| Renderer | Canvas 2D procedural paths | PixiJS mesh/shaders after core proof | Validate phenotype contract without GPU setup overhead |
| Genetics | Pure synchronous TypeScript | Same core in worker/server | Share one tested rule implementation |
| Motion | 20 Hz module worker, transferable transform frames | Render interpolation and spatial hash | Keep O(N²) reference steering away from UI |
| Persistence | IndexedDB transactions, two backups, v1 migration and Web Locks writer lease | Worker-assisted incremental persistence | Larger archives need async storage and explicit recovery |
| State | React state + motion refs | UI store only if needed | Avoid global subscription to every swimming coordinate |
| Genealogy | Exact memoized ancestor queries and paginated relatives | Worker query + incremental kinship cache | Preserve history without world-sized matrix allocation |
| Backend | None | Authoritative HTTP service + PostgreSQL | Durable transactions and trusted online ownership |
| Shared simulation | Persistent 50 ms clock, event-boundary integrator, fixed-step water per tank (FS-301) and daily life stages and growth (FS-302); no health yet | Water, development and scheduled lifecycle events | One deterministic integrator must serve visible/background/offline modes |

React documents Vite as one option for a custom setup; Vite provides the React TypeScript build workflow. These choices fit this single-page research application, rather than implying every React app needs this stack. [React guidance](https://react.dev/learn/creating-a-react-app), [Vite guide](https://vite.dev/guide/).

PixiJS meshes expose geometry, UVs, indices and shaders, which fit a procedural body and fin pipeline. Adoption still requires a measured benchmark and a rendering spike. [PixiJS Mesh documentation](https://pixijs.com/8.x/guides/components/scene-objects/mesh).

Workers communicate through messages and cannot directly manipulate the document. IndexedDB provides asynchronous structured storage and transactions. The app will need adapters and failure handling, not only new dependencies. [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers), [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API).

Installed dependency versions are pinned in package.json and package-lock.json. Use npm ci; do not replace the lockfile with whatever is newest during an unrelated task.

## 3. Separation rules

1. **Genome owns inherited information.** No generated name, UI state, current water condition, or sale price belongs in it.
2. **Development interprets genome.** Rendering must not invent a new trait, apply a mutation, or decide sex.
3. **Simulation owns evolving world state.** Rendering can interpolate visual motion but does not create births or award currency.
4. **Commands own mutation boundaries.** UI proposes actions; validated commands commit them atomically.
5. **Identity outlives ownership and life.** Sales and deaths never delete ancestry.
6. **Save version and model version are separate.** A syntactic migration does not automatically authorize visual reinterpretation.
7. **Local sandbox and trusted online worlds are separate authorities.**

## 4. Target domain model

```ts
type WorldId = string;
type FishId = string;
type Tick = number; // integer; persisted scheduler time

interface FishRecord {
  id: FishId;
  worldId: WorldId;
  name: string;
  origin: 'founder' | 'bred' | 'imported-sandbox';
  parentIds: readonly [FishId, FishId] | null;
  generation: number;
  birthTick: Tick;
  birthSeed: number;
  genome: VersionedGenome;
  developmentVersion: number;
  phenotypeVersion: number;
  rendererVersion: number;
}
interface FishState {
  fishId: FishId;
  stage: 'egg' | 'fry' | 'juvenile' | 'adult' | 'elderly' | 'dead';
  tankId: string | null;
  ownerId: string;
  ownershipVersion: number;
  lengthCm: number;
  massKg: number;
  hunger: number;
  stress: number;
  health: number;
  development: DevelopmentAccumulator;
  breedingReadyTick: Tick;
}
interface FishArchive {
  fishId: FishId;
  lastPublicPhenotype: Phenotype;
  portraitAssetId: string | null;
  visibility: 'private' | 'lineage-only' | 'public';
}
```

These are target interfaces, not declarations to copy into the app unchanged. Define VersionedGenome, units and DevelopmentAccumulator as part of the relevant milestone. Separate normalized model values from physical/game units.

### Tables / local stores

| Store | Key and important indexes | Retention |
|---|---|---|
| worlds | world_id; owner; schema/model versions; tick; rng states | World lifetime |
| fish_records | fish_id; world_id; mother_id; father_id; birth_tick | Permanent lineage |
| fish_states | fish_id; owner_id/status; tank_id/stage | Current state |
| genomes | fish_id/version; canonical digest | Immutable per birth |
| fish_events | event_id; fish_id/tick; command_id | Append-only, compact old detail if needed |
| tanks | tank_id; world_id; water state; capacity reservations | World lifetime |
| decorations | decoration_id; tank_id; transform; asset/version | Until removed |
| clutches | clutch_id; parent IDs; nursery; remaining reserved slots; next event tick | Active + birth summary |
| mutation_origins | event_id; first carrier; locus; from/to; model version | Permanent provenance |
| bloodlines | line_id; registration event; founder links; standard/version | Persistent |
| listings | listing_id; fish_id unique when active; seller; price; version; expiry | Lifecycle + audit |
| wallet_entries | entry_id; account_id; transaction_id; amount; reason | Append-only |
| checkpoints | world_id/sequence; checksum; payload; created_at | Rotating recovery set |

Do not store one duplicated ancestor tree per fish. Parent edges form a directed acyclic graph. Siblings, descendants, common ancestors and lineage contributions are derived queries.

## 5. Commands, events, and transactions

The lab clones the small world, validates, applies a command and swaps state. This provides simple atomic rejection. Move this boundary to a transaction/reducer architecture before population size makes full clones costly.

### Implemented M2 foundation contract

`src/core/runtime.ts` wraps the unchanged `World` v1 in `Runtime` save schema v2/runtime v1. It stores world ID, integer tick, monotonic revision, a checkpoint and fewer than 64 command events. The actual envelope is `{protocol: 1, worldId, commandId, expectedRevision, issuedAtTick, payload}`. Actor authentication is not meaningful in this local sandbox and is deferred to the online authority.

Command IDs are `worldId:revision`, events are `worldId:event:revision`. The domain parses payloads before cloning or mutation. Exact recent retries return the current runtime; conflicting content and stale revisions reject. Every 64 commands the current state becomes the replay checkpoint; older IDs remain stale, so compaction cannot duplicate births or credits. This is bounded recovery history, not the permanent FS-404 life-event journal. Import validates both worlds, replays the ordered events, and checks the resulting snapshot/tick/revision. Property order has no semantic meaning.

The UI advances one monotonic integer clock every five minutes (`ACTIVE_CHECKPOINT_MS`) and samples it again when committing a command. Every owned tank receives the same elapsed ticks through `advanceRuntime`, independent of which tank is visible. The same bounded segment builder splits future model integration at scheduled event ticks. Motion controls still affect visual swimming only. Each advance is an autosave, and every commit serializes the world and validates the new, current and backup snapshots on the main thread. A 10,000-record world costs about 1.3 s per commit in the recorded Chrome run, so idle checkpoints are sparse (ADR-031). The saved tick and `savedAt` always describe the same moment, so reload catch-up covers any gap after the last save. At most five minutes of active time can count toward the offline cap.

On reload, `savedAt` supplies elapsed real time at normal 1×. Negative elapsed time becomes zero; catch-up stops after eight real hours and reports any protected remainder. This currently advances research time only. It does not age fish, change health or consume resources because those domain states do not exist yet.

The following envelope describes future server-authoritative work:

### Target command envelope

```ts
interface CommandEnvelope<T> {
  commandId: string;        // idempotency key
  worldId: string;
  actorId: string;
  expectedWorldVersion: number;
  issuedAtTick: number;
  payload: T;
}
type Result<T> =
  | { ok: true; value: T; worldVersion: number; events: DomainEvent[] }
  | { ok: false; code: string; message: string; retryable: boolean };
```

Representative commands: RenameFish, TransferFishBatch, ReserveClutch, CancelCourtship, PlaceDecoration, FeedTank, SetEquipment, RehomeFish, CreateListing, BuyListing, CancelListing. Each has declared preconditions, events, failure codes, and replay rules.

The lab reducer currently implements `rename`, `move`, `breed`, `sell`, `sell-batch`, `buy`, `add-tank` and `decorate`. `breed` and `buy` carry an optional `genomeVersion`: the app sends the current genome version, and commands recorded before FS-113 omit it and replay exactly as genome v1 (ADR-034). `sell-batch` validates every member (non-empty, unique, living) before paying for any of them, so one invalid member rejects the whole batch.

**Breed:** validate eligible parents and current ownership; reserve cohort slots; commit courtship/clutch record; scheduler emits hatch events at an exact tick. Recheck relevant health/status rules at conception and handle interrupted courtship without losing reservations.

**Move:** verify all selected fish, destination biomass, reservations, locks, and equipment suitability; commit all or none. Camera navigation is a separate UI action.

**Sell:** calculate authoritative price and eligibility, archive/update ownership, commit wallet entry and event. A duplicate command cannot pay twice.

**Buy listing:** lock listing/fish/affected wallets in a stable order; compare listing version; ensure funds, owner, status, and destination capacity; write balanced ledger entries and new ownership; mark sold; return transaction ID. Roll back fully on any failed check.

Never rely on disabling a button as the transaction guarantee.

## 6. Time and simulation levels

### Time contract

Persist integer world ticks and explicit speed multipliers. The real timestamp is metadata and offline-elapsed input. A browser refresh must not reroll or repeat the scheduled event at a tick.

Target fixed active simulation step: 50 ms (20 Hz). Rendering uses requestAnimationFrame, interpolating between previous/next transforms. Cap accumulated wall-time after a stall; lifecycle catch-up runs through the scheduler, not thousands of animation frames.

### Simulation levels

| Level | Scope | Work |
|---|---|---|
| Visible | One active tank | Local steering, collisions/avoidance, state selection, feed targets, interpolation |
| Background owned | Loaded but unseen tanks | Coarse integrated physiology, environment, scheduled births; no individual visual trajectories |
| Offline | Protected elapsed interval | Deterministic aggregate integration up to cap; event-boundary splitting; return summary |
| Archive | Sold/dead/external inactive | Immutable record and last public portrait; no local live AI |

Changing a tank’s visibility must not change birth RNG, lifetime, economy, or developmental results. Separate the high-frequency visual simulation from lifecycle equations shared by all levels.

### Proposed offline rules

- Standard mode cap: 8 real hours converted using normal 1× game time, independent of the last chosen fast-forward setting.
- Auto-feeding/equipment consumes known reserves; at reserve exhaustion, protective mode freezes harmful progression and reports why.
- No new unsolicited clutches during offline catch-up. Already committed clutches honor their reservations and stage policy.
- Handle negative clock deltas as zero. Sandbox clock manipulation is acceptable; online uses server time.
- Process at scheduled event boundaries, using bounded integration steps and checkpoints for long jobs.

These are design defaults requiring numerical comparison against active simulation before shipping.

### Implemented water model (FS-301)

`src/core/water.ts` holds one well-mixed compartment per tank in world save v2: volume (L), temperature (°C), dissolved oxygen (mg/L), ammonia nitrogen (mg N/L), uneaten food (g), biofilter capacity (mg N per game day) and aeration (kLa per game day). Care time is one game day per 1,200 ticks (60 real seconds at 1×). Water advances in fixed 25-tick steps (half a game hour) counted by absolute step boundaries, so any split of an interval produces identical values.

Each step, in order:
- **Food:** uneaten food decays.
- **Ammonia:** excretion and decaying food add ammonia. The biofilter nitrifies it with saturating capacity, slowed at low oxygen.
- **Oxygen:** aeration moves oxygen toward temperature-dependent saturation. Respiration, food decay and nitrification draw on the oxygen available; unmet demand is recorded rather than going negative.
- **Temperature:** it scales biological rates within bounds.

The step uses only basic arithmetic, so saved doubles match across browsers.

`src/core/habitat.ts` sums living residents' load at adult genetic potential: mass = 0.0148 g × cm³, with metabolism and oxygen-demand loci. `advanceRuntime` advances every tank's water, visible or not. `decodeRuntime` replays to the snapshot tick and compares water too. Water does not harm fish; it slows development through condition (FS-302). Health and care controls belong to FS-305.

### Implemented life model (FS-302)

`src/core/development.ts` holds life model v1, and world save v3 stores each fish's `life`: age in game days, current length and condition.

- **Advancing:** `advanceWorld` interleaves the fixed water steps with one development pass at every absolute game-day boundary. Residents load the water at their current mass, and each living fish develops from its tank's water and crowding at that boundary.
- **Breeding:** breeding lays eggs. Eggs cannot breed or be sold, and goal leaders skip them; the lab still lets hatched fish breed until FS-401.
- **Display:** the app previews the clock every five seconds without saving. The tank draws fish at their current size, with an eggs-incubating count, and cards and the inspector show stage, age and condition beside adult potential.
- **Older saves:** older world versions are validated against records only and rebased with migrated young-adult life state (ADR-038).

## 7. Worker and renderer protocol

Motion protocol v1 accepts initialize, fish synchronization, playback, feed, benchmark and shutdown messages. The worker replies with ready/entity maps, frames, benchmark results and faults. Entity IDs establish stable frame order; every fish occupies four `Float32` values: normalized x/y and vx/vy. Each frame allocates and transfers a new buffer, so the worker never reads a detached source. SharedArrayBuffer and cross-origin isolation are unnecessary.

The worker owns 20 Hz steering and its transient actors. Canvas keeps transforms in refs, paints with `requestAnimationFrame`, and does not put coordinates in React state. Switching tanks deliberately creates a deterministic visual trajectory from fish IDs; persistent lifecycle ticks are unaffected. Fish that join the visible tank get an actor on the next frame. Playback pauses while the document is hidden. React cleanup sends shutdown and terminates the worker. The client attempts one automatic restart, then exposes a visible manual restart after a repeated failure.

Commands remain in the pure versioned runtime reducer rather than the visual-motion worker. This preserves the existing synchronous atomic boundary and prevents rendering faults from changing identity, births or status or currency. A later worker-owned biological scheduler may call the same reducer through a separate protocol.

Renderer interface: initialize, resize, updatePhenotypes, updateTransforms, setSelection, hitTest, renderPortrait, destroy. Keep Canvas as a reference/fallback while a PixiJS implementation proves visual parity.

## 8. Persistence and migrations

The current IndexedDB database `fishtank-sim` (version 1), object store `snapshots`, holds `current`, `backup1` and `backup2`. Each entry carries raw runtime-v2 JSON, an independent commit token and a saved timestamp. The session serializes writes; each transaction checks the token, rotates valid backups, writes current and verifies read-back before completion. An aborted transaction leaves all three slots unchanged. Browser storage can still be evicted or denied; exports remain necessary for portable copies. See the [IndexedDB transaction specification](https://www.w3.org/TR/IndexedDB/).

Startup validates saved data before exposing controls. With no IndexedDB current/backup, it migrates legacy world v1 from `fishtank-sim.lab.v1` and retains those original localStorage bytes after commit. An unreadable current snapshot, missing current with backups, or invalid legacy save opens a temporary session with autosave blocked. Explicit recovery preserves unreadable current records under `preserved-<token>` before replacing them. They remain in the store; the panel exposes current/two backups and the preserved localStorage source for export.

Saves accepts a file or pasted JSON, validates v1/v2, shows record/living/tank/credit counts, then requires the user's explicit replacement action. This is a product action, not an agent approval requirement. A prior valid current becomes a recovery backup. Malformed/future saves cannot replace it. Commands pause during explicit save/replacement. Device-local goal/favorite preferences remain outside world exports, as the panel explains.

Web Locks holds `fishtank-sim-writer` for the editing tab’s lifetime. Other tabs load the same snapshot for inspection but domain commands return a read-only explanation. Closing the writer and reloading a reader transfers authority; drafts made in the reader are never committed. Browsers without Web Locks retain compare-and-swap stale-write rejection. Save validation and command replay still run on the main thread; the 10,000-record fixture took about 755 ms for commit/load/validation on the recorded Chrome run.

## 9. Online boundaries

PostgreSQL is the target transactional database; hosting/vendor selection is deferred. Keep provider-specific auth and database clients outside domain core.

**Target HTTP contracts**

| Endpoint | Main preconditions | Response |
|---|---|---|
| GET /worlds/:id/snapshot | Authorized world reader | Versioned summary + paginated fish |
| POST /worlds/:id/commands | Auth, ownership, idempotency, version | Command result |
| GET /fish/:id | Public scope or authorized owner | Redacted record + phenotype |
| GET /fish/:id/family?depth=3 | Visibility and depth budget | Bounded graph with tombstones |
| GET /market/listings?cursor=... | Validated bounded filters | Stable pagination + quote scope |
| POST /market/listings | Owner, eligible fish, no existing lock | Listing + version |
| POST /market/listings/:id/purchase | Idempotency, funds, version, capacity | Atomic transaction result |
| DELETE /market/listings/:id | Seller, current active listing | Cancellation event |

Server validates all price/genome/ownership claims, applies rate limits, bounds filter complexity, and redacts private pedigree/owner data. Secrets never enter frontend bundles. Escape user names as text. Uploaded custom content is outside early scope.

## 10. Performance targets and instrumentation

Targets are hypotheses until a named machine and browser are recorded:

- 60 FPS visible aquarium on a desktop integrated GPU for 60 medium-detail fish.
- 20 Hz active simulation with p95 update under 10 ms in a worker.
- Input-to-selection feedback below 100 ms under target load.
- First playable profile target: 200 active-detail fish after spatial hashing and render caching.
- Background test: 2,000 owned fish across 20 tanks; no full-detail simulation for invisible tanks.
- Archive test: 50,000 records with bounded three-generation navigation and pagination.
- 100-generation offline genetic stress experiment without invalid phenotypes.

Lab limits are eight tanks × 60 residents, 480 living fish and 10,000 total records. They are safety boundaries, not proof of those target budgets.

Measure simulation step duration, render duration, entities, triangles, shader count, material-cache bytes, save transaction time, pedigree-query duration, catch-up duration, and command rejection reasons. Use local diagnostics by default; no telemetry transmission is implemented.

## 11. Delivery and repository practices

Run npm ci, npm test, npm run build. Static output is dist/. Changes are pushed to GitHub main after verification; no public deployment has been performed. No environment variables or hosted services are required for the lab.

Add continuous integration for supported Node, unit tests and build. Add browser automation only after stable controls and a reproducible test harness exist. Source assets must have known licenses. Google Fonts currently supplies optional typefaces; system fonts are fallbacks. Self-host approved fonts when offline asset independence becomes a requirement.

Before each milestone, freeze relevant contracts and fixtures. Finish a vertical user flow before expanding adjacent subsystems. Keep a short implementation status and evidence log so subsequent agents do not infer completion from aspirational interfaces.
