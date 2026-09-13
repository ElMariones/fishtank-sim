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
    descriptors.ts  Fourteen visible descriptors normalized against development ranges
    collection.ts   Device-local collection preferences, goal ranking, sorting, cohorts and goal leaders
    pedigree.ts     Exact tabular relationship matrix for the bounded lab
    world.ts        Validated world commands and local NPC transactions
    save.ts         Versioned save schema and reference validation
    visualFixtures.ts Frozen FS-101 fixtures, anatomy stress cases and v1-vs-v2 anatomy sweep
  simulation/
    motion.ts       Pure 20 Hz steering step, independent of React/Canvas
  rendering/
    fish.ts         Canvas renderer v2: draws anatomy v2 and pigment layers
    tankLayout.ts   Shared tank pose transform and fish-shaped picking
  ui/
    App.tsx         Lab controls, local persistence, inspector and collection
    TankCanvas.tsx  Frame loop, visual aquarium and selection
    FishPortrait.tsx Shared procedural renderer at portrait scale, fitted or shared-scale framing
    VisualFixtureLab.tsx Deterministic fixture and anatomy comparison surface
    styles.css     Responsive theme and layout
  main.tsx         React entry
tests/
  core.test.ts     Genetics, pedigree, commands, saves, motion, FS-101 fixture pins
  anatomy.test.ts  Anatomy attachment sweep, framing without clipping, picking transform
  pattern.test.ts  Marking block derivation, transmission, placement jitter and resemblance thresholds
  collection.test.ts Preference validation, collection ordering, cohorts and goal leaders
```

Core modules import neither React nor browser globals. The Canvas renderer receives a phenotype, seed, size and animation time; it obtains geometry from the pure anatomy module, so tests validate the same eye, fin and tail anchors that are drawn and the tank uses one pose transform for drawing and picking. Motion has its own actors and reads genetic movement parameters. The app owns persisted entities and selected UI state.

There is currently **no backend, Web Worker, IndexedDB, WebGL mesh, life-stage scheduler, authentication, or online market**. These are planned boundaries, not existing infrastructure.

## 2. Stack decisions

| Concern | Current | Next target | Reason |
|---|---|---|---|
| UI and tooling | React, strict TypeScript, Vite | Retain | Browser simulation does not require server rendering |
| Renderer | Canvas 2D procedural paths | PixiJS mesh/shaders after core proof | Validate phenotype contract without GPU setup overhead |
| Genetics | Pure synchronous TypeScript | Same core in worker/server | Share one tested rule implementation |
| Motion | 20 Hz main-thread step | Worker with render interpolation | Keep expensive updates away from UI |
| Persistence | Versioned localStorage snapshot | IndexedDB transactions and migrations | Lab is small; larger worlds need async structured storage |
| State | React state + motion refs | UI store only if needed | Avoid global subscription to every swimming coordinate |
| Genealogy | Local matrix and clickable relatives | Indexed ancestor graph + incremental kinship cache | Preserve history without loading the entire universe |
| Backend | None | Authoritative HTTP service + PostgreSQL | Durable transactions and trusted online ownership |
| Shared simulation | None | Tick/event jobs on server | Browser cannot be online-market authority |

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

The lab reducer currently implements `rename`, `move`, `breed`, `sell`, `sell-batch`, `buy`, `add-tank` and `decorate`. `sell-batch` validates every member (non-empty, unique, living) before paying for any of them, so one invalid member rejects the whole batch.

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

## 7. Worker and renderer protocol

```ts
type ToSimulation =
  | { type: 'initialize'; protocol: 1; snapshot: WorldSnapshot }
  | { type: 'command'; command: CommandEnvelope<WorldCommand> }
  | { type: 'set-visible-tank'; tankId: string }
  | { type: 'set-speed'; speed: 0 | 1 | 4 | 12 }
  | { type: 'request-checkpoint'; requestId: string };
type FromSimulation =
  | { type: 'ready'; worldVersion: number }
  | { type: 'frame'; tick: number; tankId: string; transforms: Float32Array }
  | { type: 'state-delta'; worldVersion: number; delta: WorldDelta }
  | { type: 'command-result'; commandId: string; result: Result<unknown> }
  | { type: 'checkpoint'; requestId: string; snapshot: WorldSnapshot }
  | { type: 'fault'; code: string; recoverable: boolean };
```

Define stable transform layout, entity-index mapping and transfer-buffer ownership before implementation. Never transfer a buffer then continue reading the detached source. Start with ordinary messages; SharedArrayBuffer/cross-origin isolation is unnecessary until measured.

The UI should receive lightweight deltas at 2–5 Hz for telemetry, immediate command acknowledgements, and transform packets for renderer interpolation. Do not put per-fish coordinates into a broad React store that redraws the entire inspector 20 times per second.

Renderer interface: initialize, resize, updatePhenotypes, updateTransforms, setSelection, hitTest, renderPortrait, destroy. Keep Canvas as a reference/fallback while a PixiJS implementation proves visual parity.

## 8. Persistence and migrations

Lab v1 uses localStorage at `fishtank-sim.lab.v1`. Save decoding validates shape, allele bounds, unique IDs, tank membership, pedigree roles/generation, capacities, and next-ID monotonicity. Malformed/unsupported data is preserved; a temporary world is allowed without overwriting it. Export downloads JSON. Import UI is not implemented yet.

Next:

1. Introduce a persistence interface with load, commit, export, importPreview, importCommit and recovery.
2. Write IndexedDB snapshots and event batches transactionally.
3. Maintain two known-good rotating checkpoints plus the current state.
4. Keep legacy localStorage untouched until a validated import and read-back succeed.
5. Reject future versions safely; back up pre-migration data.
6. Validate IDs, DAG, money bounds, fish capacity and versioned phenotype consistency.
7. Enforce one writer per world across tabs, using a lock/session lease and visible read-only fallback.
8. Make save failures persistent UI warnings; provide export.

A JSON parse success is not a valid save. Do not blindly assert TypeScript types over user-controlled data.

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

Lab limits remain eight tanks × 60 residents and 1,000 total records. They are safety boundaries, not proof of those target budgets.

Measure simulation step duration, render duration, entities, triangles, shader count, material-cache bytes, save transaction time, pedigree-query duration, catch-up duration, and command rejection reasons. Use local diagnostics by default; no telemetry transmission is implemented.

## 11. Delivery and repository practices

Run npm ci, npm test, npm run build. Static output is dist/. A public deployment or remote push has not been performed. No environment variables or hosted services are required for the lab.

Add continuous integration for supported Node, unit tests and build. Add browser automation only after stable controls and a reproducible test harness exist. Source assets must have known licenses. Google Fonts currently supplies optional typefaces; system fonts are fallbacks. Self-host approved fonts when offline asset independence becomes a requirement.

Before each milestone, freeze relevant contracts and fixtures. Finish a vertical user flow before expanding adjacent subsystems. Keep a short implementation status and evidence log so subsequent agents do not infer completion from aspirational interfaces.
