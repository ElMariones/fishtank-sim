# Handoff for the next developer or agent

## 1. Context

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

## 5. Verification and task completion

Run npm test and npm run build after core/code changes. Browser verification should exercise the affected journey, not just inspect a screenshot. Read TESTING.md before broadening tests.

Meaningful existing tests include Mendelian 1:2:1 segregation, linkage probability, mutation boundary transitions, pedigree fixtures, command atomicity, save validation, artificial selection and anatomy attachment/framing sweeps. They do not prove art quality or realistic biology.

Update implementation status with changed behavior and limitations; update testing evidence with exact command/result/environment; change decision log if a contract or architecture choice moves. Avoid claiming a milestone gate passed just because tests are green. The user asked that backlog items be marked DONE only once their work is pushed.

## 6. Recommended next prompt

> M3 is DONE (FS-305 `d425639`, FS-306 `325ceb4`, FS-307 `a5d5ddc`). FS-401/402 normal breeding is DONE, pushed `9aabfdb`. FS-404's bounded six-generation family graph is DONE, pushed `b7c3e37`. FS-405's incremental kinship cache is DONE, pushed `850f501`. FS-406's clutch selection, batch rehoming and two-generation demonstration are DONE, pushed `44d7d98`, completing M4's task list. M5 has started: FS-501's economy model v1 is DONE, pushed `006b500` (see the FS-501 report). FS-502 persistent shop is DONE, pushed `3945d86`; see its research report. FS-503 paid expansion and placed decorations are DONE, pushed `f78d007`. FS-504's first-session guide, koi rescue and family at a glance are verified locally, awaiting push; see the FS-504 report. Continue with FS-505: playtest the complete loop and report paid-economy sources and sinks, including rescues. Keep sale commands carrying a price model, the ledger reconciled, a free or affordable fix on every care warning, and migrations writing keys in schema order.

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
