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
| FS-103 | DONE | 2 | Genetics/rendering | FS-101 | Add inherited low-frequency pattern structure; sibling markings share recognizable family properties. Pushed `bf4598b`; evidence in [FS-103 inherited markings](research/FS-103-INHERITED-MARKINGS.md) |
| FS-104 | DONE | 1 | UI | FS-003 | Cohort sorting and favorites; choose new parents without losing selected goal. Pushed `2c8f18c` |
| FS-105 | DONE | 2 | Simulation/design | FS-102 FS-103 FS-104 | Ten-generation selection report plus small resemblance study; record outcomes and failures. Pushed `8180019`: selection report, computational observer and blind study harness; human sessions split to FS-111. Evidence in [FS-105 selection and resemblance](research/FS-105-SELECTION-AND-RESEMBLANCE.md) |
| FS-106 | DONE | 1 | UI/accessibility | FS-104 | Keyboard, 200% text and touch pass for select/rename/breed/family. Pushed `bd175ed` |
| FS-107 | DONE | 1 | Integration | FS-105 FS-106 | Resolve critical findings; publish local milestone evidence and updated contracts. Pushed `bd175ed`; review delivered, human gate remains open (FS-111) |
| FS-108 | DONE | 0.25 | UI | FS-003 | User request: larger sex symbols, pink ♀ for female and blue ♂ for male, still paired with text for assistive technology. Pushed `621a3cb` |
| FS-109 | DONE | 1 | UI/core | FS-003 | User request: select several residents in the collection (including shift-click ranges) and sell them in one reviewed batch; any invalid member rejects the whole sale with no credit or status change. Pushed `621a3cb` |
| FS-110 | DONE | 0.25 | UI | FS-108 | User request: collection buttons to show all fish, only females or only males, with counts, in resident and archive views; changing the filter clears batch selection so a sale only covers visible fish. Pushed `c467a26` |
| FS-111 | DONE | 0.5 | Design/QA | FS-105 | Run the in-app resemblance study with at least five observers (60 trials, 20 per mode); pool the copied result records and report accuracy per mode against 50% chance, with cues. Pushed `6a69695`: five observers, 54/60 overall, above chance in every mode, no cue notes supplied. Evidence in [FS-111 human resemblance](research/FS-111-HUMAN-RESEMBLANCE.md) |
| FS-112 | DONE | 1 | Core/UI | FS-109 | User request: raise the 1,000-record limit well beyond 1,000 and cap living (unsold) fish instead, so players can keep breeding while sold fish stay in the archive; kinship and large archive views must stay responsive; the record cap must fit reliable browser storage. Pushed `bd175ed` |

| FS-113 | DONE | 3 | Genetics/rendering | FS-103 FS-111 | User request after M2: genome v2 Color and Ornament chromosomes with more body, accent, dot and eye colors, fine multicolor spots, tiger stripes, marbling, calico, rosettes and mixes, scale types and shimmer, and tail/dorsal patterns. Rare features appear in about one founder in four; existing genome v1 fish keep their exact look, and FS-101–111 fixtures stay unchanged. Pushed `2436fbf`; evidence in [FS-113 appearance genetics](research/FS-113-APPEARANCE-GENETICS.md) |

FS-108 to FS-110 were requested during M1, and FS-113 after M2; all are outside the base estimates. FS-111 splits the human part of FS-105 out because it needs real participants.

## M2 — 15 days

| ID | Pri | Days | Role | Depends | Task and acceptance |
|---|---|---:|---|---|---|
| FS-201 | DONE | 2 | Core | FS-107 | World tick, command/event IDs, versioned replay; repeated command cannot duplicate births. Pushed `bd175ed` |
| FS-202 | DONE | 3 | Runtime | FS-201 | Worker protocol with lifecycle cleanup; selection stays responsive during 200-fish synthetic workload. Pushed `6a69695`; evidence in [M2 runtime and recovery](research/M2-RUNTIME-AND-RECOVERY.md) |
| FS-203 | DONE | 3 | Persistence | FS-201 | IndexedDB transactions, two backups, legacy migration and read-back; interrupted commit restores last good save. Pushed `bd175ed` |
| FS-204 | DONE | 2 | UI/persistence | FS-203 | Validated import preview and export/recovery UI; malformed/future save never overwrites current world. Pushed `bd175ed` |
| FS-205 | DONE | 3 | Simulation | FS-201 FS-202 | Shared active/background integration and protected offline scheduler; event-boundary fixtures agree within tolerance. Pushed `6a69695` |
| FS-206 | DONE | 2 | Persistence/runtime | FS-203 FS-205 | Multi-tab writer lock, worker-fault recovery and quota handling; user sees and can recover from each fault. Pushed `6a69695` |

## M3 — 20 days

| ID | Pri | Days | Role | Depends | Task and acceptance |
|---|---|---:|---|---|---|
| FS-301 | DONE | 3 | Simulation | FS-205 | Unit-aware water/oxygen/waste model; zero/overload/recovery conservation fixtures. Pushed `4f61d8b`; evidence in [FS-301 water model](research/FS-301-WATER-MODEL.md) |
| FS-302 | DONE | 3 | Development | FS-301 | Eggs/fry/juvenile/adult stages and accumulated growth; same genome develops differently under declared conditions. Pushed `5821f46`; evidence in [FS-302 life stages](research/FS-302-LIFE-STAGES.md) |
| FS-303 | DONE | 4 | Behavior | FS-202 FS-301 | Utility AI with inspectable reasons; cruise/forage/eat/hide/school transitions work. Pushed `e7aefc1`; [evidence](research/FS-303-BEHAVIOR-AND-BREEDING.md) |
| FS-304 | DONE | 2 | Spatial/runtime | FS-303 | Spatial hash and shared shelter/rock footprints with anticipatory avoidance and body-center clearance. Local-density scaling fixture; extreme fins may overlap. Pushed `5dbfb73`; [Evidence](research/FS-304-403-SPATIAL-AND-PREDICTION.md) |
| FS-305 | DONE | 3 | UI/simulation | FS-301 FS-302 | Feeding/equipment/water controls with cost/effect previews; care warnings identify corrective actions. Pushed `d425639`; [evidence](research/FS-305-CARE-CONTROLS.md) |
| FS-306 | DONE | 3 | Rendering | FS-102 FS-302 | Juvenile reveal and smooth body/fin animation; actual stage and adult preview clearly distinguished. Pushed `325ceb4`; [evidence](research/FS-306-JUVENILE-REVEAL.md) |
| FS-307 | DONE | 2 | Integration | FS-303 FS-304 FS-305 FS-306 | Healthy and stressed tanks demo, absence summary and recovery; no unexplained health decay. Pushed `a5d5ddc`; [evidence](research/FS-307-CARE-DEMO-AND-ABSENCE.md) |

## M4 — 15 days

| ID | Pri | Days | Role | Depends | Task and acceptance |
|---|---|---:|---|---|---|
| FS-401 | DONE | 3 | Breeding | FS-307 | Maturity/health/cooldown and shared habitat checks; transparent courtship blockers. Pushed `9aabfdb`; [evidence](research/FS-401-402-BREEDING-LIFECYCLE.md) |
| FS-402 | DONE | 3 | Breeding/runtime | FS-401 | Reserved clutch scheduler and bounded nursery; no overflow or duplicated hatch on reload. Pushed `9aabfdb`; [evidence](research/FS-401-402-BREEDING-LIFECYCLE.md) |
| FS-403 | DONE | 2 | UI/genetics | FS-402 | Independent prediction stream; exact single-locus odds and labeled sampled polygenic ranges. Delivered early in the lab; FS-402 lifecycle integration remains a milestone dependency. Pushed `5dbfb73`; [Evidence](research/FS-304-403-SPATIAL-AND-PREDICTION.md) |
| FS-404 | DONE | 3 | Genealogy | FS-203 FS-402 | Bounded ancestor graph with portraits and cross-tank/archived focus; six-generation navigation. Pushed `b7c3e37`; [evidence](research/FS-404-FAMILY-GRAPH.md) |
| FS-405 | DONE | 2 | Genetics/data | FS-404 | Incremental kinship cache with unknown-founder assumptions and reference fixtures. Pushed `850f501`; [evidence](research/FS-405-KINSHIP-CACHE.md) |
| FS-406 | DONE | 2 | Integration | FS-403 FS-404 FS-405 | Two-generation normal-mode demonstration, cohort selection and batch rehoming with review. Pushed `44d7d98`; [evidence](research/FS-406-TWO-GENERATIONS.md) |

## M5 — 15 days

| ID | Pri | Days | Role | Depends | Task and acceptance |
|---|---|---:|---|---|---|
| FS-501 | DONE | 3 | Economy | FS-406 | Bounded NPC demand/price rules and currency ledger; purchase/resale and breeder farming experiments documented. Pushed `006b500`; [evidence](research/FS-501-ECONOMY-MODEL.md) |
| FS-502 | DONE | 3 | UI/economy | FS-501 | Persistent shop stock and filters; refresh cannot reroll stock and purchases respect capacity. DONE, pushed `3945d86`; [evidence](research/FS-502-PERSISTENT-SHOP.md) |
| FS-503 | DONE | 3 | Habitat/UI | FS-304 FS-501 | Tank purchase/upgrades and decoration placement; transforms persist and functional footprints update. DONE, pushed `f78d007`; [evidence](research/FS-503-HABITAT-EXPANSION.md) |
| FS-504 | DONE | 3 | UX | FS-502 FS-503 | First-session onboarding, no-money recovery and discoverable family inspection. DONE, pushed `6335851`; [evidence](research/FS-504-ONBOARDING-AND-RECOVERY.md) |
| FS-505 | DONE | 3 | QA/design | FS-504 | Playtest complete loop and economy source/sink report; resolve softlocks and major confusion. DONE, pushed `f5b1888`; [evidence](research/FS-505-PAID-ECONOMY-PLAYTEST.md) |

## M6 — 15 days

| ID | Pri | Days | Role | Depends | Task and acceptance |
|---|---|---:|---|---|---|
| FS-601 | P0 | 3 | Genetics/persistence | FS-405 | Data-driven registry and genome-v3 migration; old fish retain their original expression version |
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

M1, M2 and FS-301–304 are pushed, with the independent FS-403 prediction (`5dbfb73`). M3 is DONE: FS-305 care controls (`d425639`), FS-306 juvenile reveal (`325ceb4`) and FS-307 care demonstration and absence summary (`a5d5ddc`). M4 has started: FS-401/402 normal breeding with courtship blockers and reserved nurseries is DONE (`9aabfdb`). FS-404's six-generation family graph is DONE (`b7c3e37`). FS-405's kinship cache is DONE (`850f501`). FS-406's clutch selection, batch rehoming and two-generation demonstration are DONE (`44d7d98`), completing M4's task list. Its gate is demonstrated by the seeded Research demonstration and a QA-world lineage bred twice in normal mode, not by an external playtest. M5 has started: FS-501's economy model v1 is DONE (`006b500`). FS-502 is DONE, pushed `3945d86`. FS-503 is DONE, pushed `f78d007`. FS-504 is DONE, pushed `6335851`. FS-505's paid-economy playtest is DONE, pushed `f5b1888`, completing M5's task list; its gate is shown by seeded keepers and one implementer browser session, not an external playtest. M6 FS-601 is next.

## Current user-requested additions — DONE, pushed `e7aefc1`

- FS-114 — DONE: compound breeding goals, candidate search across/all tanks, adult previews, copy odds, capacity feedback, and favorite/egg-safe bulk sales. Evidence: [FS-303 and breeding report](research/FS-303-BEHAVIOR-AND-BREEDING.md).
- FS-115 — DONE: Genome 2 allele inspection, calico color correction, organic rosettes/flecks and distinct pearl/armor scale textures; unchanged inheritance and classic v1 fixtures.
- FS-303 — DONE: implementation and tests pushed as `e7aefc1`. FS-305–307 remain open; FS-304 delivery is tracked above.
