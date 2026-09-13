# Implementation backlog

**Status:** OPEN unless marked DONE. **Effort:** focused developer-days. **Priority:** P0 blocks milestone, P1 required before its release gate, P2 optional and not in base totals. Owner roles describe expertise for future assignments; no agents are currently dispatched by this document.

Read [ROADMAP.md](ROADMAP.md) for schedule assumptions. Dependencies use task IDs. Each acceptance statement is an outcome to demonstrate, not merely a file to create.

## M0 — delivered foundation

| ID | Status | Deliverable |
|---|---|---|
| FS-000 | DONE | Original notes preserved; GDD, genetics, architecture, UX, schedule and handoff |
| FS-001 | DONE | Strict TypeScript React/Vite shell, dependency lockfile and local run scripts |
| FS-002 | DONE | 48-locus phased genetics, mutation, phenotype expression and pedigree matrix |
| FS-003 | DONE | Procedural Canvas aquarium, inspection, cross, relatives, movement and NPC command scaffold |
| FS-004 | DONE | Versioned local save validation and meaningful core tests |

M0 completion does not imply M1’s visual research gate has passed.

## M1 — 10 days

| ID | Pri | Days | Role | Depends | Task and acceptance |
|---|---|---:|---|---|---|
| FS-101 | DONE | 1 | Genetics/rendering | FS-002 | Freeze descriptor/seed fixtures; generate a reproducible cohort report and six extreme genome cases |
| FS-102 | DONE | 2 | Rendering | FS-101 | Improve geometry anchors; no detached eyes/fins or clipped silhouettes at tested extremes. Pushed `b0fd927`; evidence in [FS-102 anatomy anchors](research/FS-102-ANATOMY-ANCHORS.md) |
| FS-103 | P0 | 2 | Genetics/rendering | FS-101 | Add inherited low-frequency pattern structure; sibling markings share recognizable family properties |
| FS-104 | P1 | 1 | UI | FS-003 | Cohort sorting and favorites; choose new parents without losing selected goal |
| FS-105 | P0 | 2 | Simulation/design | FS-102 FS-103 FS-104 | Ten-generation selection report plus small resemblance study; record outcomes and failures |
| FS-106 | P1 | 1 | UI/accessibility | FS-104 | Keyboard, 200% text and touch pass for select/rename/breed/family |
| FS-107 | P0 | 1 | Integration | FS-105 FS-106 | Resolve critical findings; publish local milestone evidence and updated contracts |
| FS-108 | P1 | 0.25 | UI | FS-003 | User request: larger sex symbols, pink ♀ for female and blue ♂ for male, still paired with text for assistive technology |
| FS-109 | P1 | 1 | UI/core | FS-003 | User request: select several residents in the collection (including shift-click ranges) and sell them in one reviewed batch; any invalid member rejects the whole sale with no credit or status change |

FS-108 and FS-109 were requested during M1 and are outside the 10-day base estimate.

## M2 — 15 days

| ID | Pri | Days | Role | Depends | Task and acceptance |
|---|---|---:|---|---|---|
| FS-201 | P0 | 2 | Core | FS-107 | World tick, command/event IDs, versioned replay; repeated command cannot duplicate births |
| FS-202 | P0 | 3 | Runtime | FS-201 | Worker protocol with lifecycle cleanup; selection stays responsive during 200-fish synthetic workload |
| FS-203 | P0 | 3 | Persistence | FS-201 | IndexedDB transactions, two backups, legacy migration and read-back; interrupted commit restores last good save |
| FS-204 | P0 | 2 | UI/persistence | FS-203 | Validated import preview and export/recovery UI; malformed/future save never overwrites current world |
| FS-205 | P0 | 3 | Simulation | FS-201 FS-202 | Shared active/background integration and protected offline scheduler; event-boundary fixtures agree within tolerance |
| FS-206 | P1 | 2 | Persistence/runtime | FS-203 FS-205 | Multi-tab writer lock, worker-fault recovery and quota handling; user sees and can recover from each fault |

## M3 — 20 days

| ID | Pri | Days | Role | Depends | Task and acceptance |
|---|---|---:|---|---|---|
| FS-301 | P0 | 3 | Simulation | FS-205 | Unit-aware water/oxygen/waste model; zero/overload/recovery conservation fixtures |
| FS-302 | P0 | 3 | Development | FS-301 | Eggs/fry/juvenile/adult stages and accumulated growth; same genome develops differently under declared conditions |
| FS-303 | P0 | 4 | Behavior | FS-202 FS-301 | Utility AI with inspectable reasons; cruise/forage/eat/hide/school transitions work |
| FS-304 | P1 | 2 | Spatial/runtime | FS-303 | Spatial hash and shelter/obstacle footprints; fish avoid geometry without all-pairs scaling |
| FS-305 | P0 | 3 | UI/simulation | FS-301 FS-302 | Feeding/equipment/water controls with cost/effect previews; care warnings identify corrective actions |
| FS-306 | P1 | 3 | Rendering | FS-102 FS-302 | Juvenile reveal and smooth body/fin animation; actual stage and adult preview clearly distinguished |
| FS-307 | P0 | 2 | Integration | FS-303 FS-304 FS-305 FS-306 | Healthy and stressed tanks demo, absence summary and recovery; no unexplained health decay |

## M4 — 15 days

| ID | Pri | Days | Role | Depends | Task and acceptance |
|---|---|---:|---|---|---|
| FS-401 | P0 | 3 | Breeding | FS-307 | Maturity/health/cooldown and shared habitat checks; transparent courtship blockers |
| FS-402 | P0 | 3 | Breeding/runtime | FS-401 | Reserved clutch scheduler and bounded nursery; no overflow or duplicated hatch on reload |
| FS-403 | P1 | 2 | UI/genetics | FS-402 | Independent prediction stream; exact single-locus odds and labeled sampled polygenic ranges |
| FS-404 | P0 | 3 | Genealogy | FS-203 FS-402 | Bounded ancestor graph with portraits and cross-tank/archived focus; six-generation navigation |
| FS-405 | P1 | 2 | Genetics/data | FS-404 | Incremental kinship cache with unknown-founder assumptions and reference fixtures |
| FS-406 | P0 | 2 | Integration | FS-403 FS-404 FS-405 | Two-generation normal-mode demonstration, cohort selection and batch rehoming with review |

## M5 — 15 days

| ID | Pri | Days | Role | Depends | Task and acceptance |
|---|---|---:|---|---|---|
| FS-501 | P0 | 3 | Economy | FS-406 | Bounded NPC demand/price rules and currency ledger; purchase/resale and breeder farming experiments documented |
| FS-502 | P1 | 3 | UI/economy | FS-501 | Persistent shop stock and filters; refresh cannot reroll stock and purchases respect capacity |
| FS-503 | P0 | 3 | Habitat/UI | FS-304 FS-501 | Tank purchase/upgrades and decoration placement; transforms persist and functional footprints update |
| FS-504 | P0 | 3 | UX | FS-502 FS-503 | First-session onboarding, no-money recovery and discoverable family inspection |
| FS-505 | P0 | 3 | QA/design | FS-504 | Playtest complete loop and economy source/sink report; resolve softlocks and major confusion |

## M6 — 15 days

| ID | Pri | Days | Role | Depends | Task and acceptance |
|---|---|---:|---|---|---|
| FS-601 | P0 | 3 | Genetics/persistence | FS-405 | Data-driven registry and genome-v2 migration; old fish retain their original expression version |
| FS-602 | P0 | 4 | Rendering/genetics | FS-601 FS-306 | Validated tail topology + barbel/dorsal variants; reachable fixtures and no invalid geometry |
| FS-603 | P1 | 2 | Genetics | FS-602 | Mutation-origin propagation and save-local carrier counts with declared scope |
| FS-604 | P1 | 3 | Genealogy/UI | FS-603 FS-404 | Named bloodline registry; ancestry contribution and standard similarity shown separately |
| FS-605 | P0 | 3 | Design/QA | FS-604 | Multi-generation unusual-line demonstration; mutation discovery pacing and tradeoffs reviewed |

## M7 — 20 days

| ID | Pri | Days | Role | Depends | Task and acceptance |
|---|---|---:|---|---|---|
| FS-701 | P0 | 4 | Rendering/runtime | FS-505 FS-605 | Canvas vs PixiJS spike and chosen renderer cache/LOD; record device, frame timings and memory |
| FS-702 | P0 | 3 | QA/simulation | FS-701 | 100-generation and 2000-owned-fish soak; no invalid records, leaks or duplicate events |
| FS-703 | P0 | 3 | Persistence/QA | FS-702 | Migration matrix, quota, crash and offline restore tests; recovery works without silent reset |
| FS-704 | P1 | 3 | UI/accessibility | FS-701 | Keyboard and touch flows, contrast and reduced motion; cross-browser baseline documented |
| FS-705 | P0 | 4 | Design/QA | FS-703 FS-704 | External solo playtests and fixes; first-session and retention hypotheses reviewed |
| FS-706 | P0 | 3 | Integration | FS-705 | CI, release notes, tested static packaging and alpha handoff with known limitations |

## M8 — 40–60 days, separate release

| ID | Pri | Days | Role | Depends | Task and acceptance |
|---|---|---:|---|---|---|
| FS-801 | P0 | 5–8 | Backend | FS-706 | Authoritative world schema, auth/ownership and sandbox separation; unauthorized reads/writes rejected |
| FS-802 | P0 | 7–10 | Backend/runtime | FS-801 | Server command scheduler, idempotency and durable simulation; client clocks/genomes cannot alter trusted inventory |
| FS-803 | P0 | 6–9 | Backend/economy | FS-802 | Fixed-price listings and atomic ledger transfer; competing purchases allow one winner |
| FS-804 | P1 | 5–8 | Search/UI | FS-803 | Bounded searchable genetics marketplace and private pedigree redaction |
| FS-805 | P1 | 4–6 | Data | FS-802 | Authoritative seasonal frequency snapshots with timestamp/sample size and confidence rules |
| FS-806 | P0 | 7–10 | Security/QA | FS-804 FS-805 | Abuse/concurrency/privacy tests, restore rehearsal and transaction audit |
| FS-807 | P0 | 6–9 | Integration/design | FS-806 | Private pilot, market source/sink observation and launch readiness decision |

M8 total: 40–60 days. Provider costs and moderation operations require separate estimates after platform selection.

## Optional later work — unestimated

- FS-901: auctions and player trade offers.
- FS-902: competitions and verified breeding prestige.
- FS-903: opt-in hidden sequencing/discovery mode.
- FS-904: elaborate optical shaders and optional ambient audio.
- FS-905: additional ancestry families with crossability rules.
- FS-906: richer learned behavior and mate-preference selection experiments.

## Suggested next-agent task

FS-101 and FS-102 are complete and pushed. Continue with **FS-103**: inherited low-frequency pattern structure, measured against the frozen FS-101 cohorts. Preserve genome v1, locus order, fixture signatures and the anatomy v2 contract; do not start a shop, backend or genome-v2 migration during this task.
