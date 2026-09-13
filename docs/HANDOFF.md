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

Genetics use 48 loci with two array copies. Indices matter. Genotype changes, expression changes, and renderer changes have different compatibility consequences; avoid silently changing the appearance of existing saved fish.

Mutations are 0.003 **per copy**. There are 96 transmitted copies, so about one quarter of lab births carry a small de novo mutation. This is a research setting.

The current portrait is adult potential, not current life stage. Life-history values in phenotype are not yet integrated. Food is a temporary attraction target. The plant button is cosmetic. Lab credits are local NPC plumbing, not a balanced economy.

Geometry lives in `src/core/anatomy.ts` (anatomy v2). The Canvas renderer draws it, portraits frame from its bounds, and the tank uses `src/rendering/tankLayout.ts` for both drawing and picking. Change anchors there and extend `tests/anatomy.test.ts`; do not add renderer-only geometry exceptions.

The live Canvas’s transient actors are outside React state. Motion is deterministic for the same initial actors and tick sequence, but positions are not persisted; switching tanks reconstructs visual trajectories. Birth/genome outcomes do persist.

Sales preserve the full fish record, including parent IDs and genome. The archive assumes sold fish are no longer locally living; online ownership/death states must be modeled separately later.

Save decoding must continue to reject invalid future schemas without overwriting stored data. Saves now supports v1/v2 import preview, explicit replacement and two-backup recovery. Preserve the IndexedDB compare-and-swap token and legacy raw data. Runtime schema v2 wraps world/genome v1; do not reset revision when compacting the replay journal.

## 5. Verification and task completion

Run npm test and npm run build after core/code changes. Browser verification should exercise the affected journey, not just inspect a screenshot. Read TESTING.md before broadening tests.

Meaningful existing tests include Mendelian 1:2:1 segregation, linkage probability, mutation boundary transitions, pedigree fixtures, command atomicity, save validation, artificial selection and anatomy attachment/framing sweeps. They do not prove art quality or realistic biology.

Update implementation status with changed behavior and limitations; update testing evidence with exact command/result/environment; change decision log if a contract or architecture choice moves. Avoid claiming a milestone gate passed just because tests are green. The user asked that backlog items be marked DONE only once their work is pushed.

## 6. Recommended next prompt

> Continue with FS-202, then FS-205 and FS-206. Read the M1 review/M2 foundation report, src/core/runtime.ts, src/persistence/*, docs/ARCHITECTURE.md and docs/TESTING.md. Implement a versioned worker protocol with cleanup and a 200-fish synthetic responsiveness measurement; preserve the existing command IDs, validated replay and IndexedDB recovery. Current world ticks advance only when a command commits; FS-205 must define active/background/offline integration without inventing care or hatch mechanics that do not yet exist. M1 FS-111 still needs at least five real observers; never substitute scripted browser answers.

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
