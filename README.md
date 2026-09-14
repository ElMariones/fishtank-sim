# Fishtank Sim

A living aquarium and genetics sandbox where ordinary koi can become the ancestors of extraordinary lineages.

**Current version: 0.1 — working research lab and project design handoff.** The long-term game is specified in the documents below. The current app proves a bounded core loop; it is not yet the full care simulation or an online marketplace.

## Run locally

Requires Node.js 22.12+ (verified here with Node 24.11.1) and npm.

```sh
npm ci
npm run dev
```

Open the local address printed by Vite, normally [http://127.0.0.1:5173](http://127.0.0.1:5173). No accounts, API keys, database, or environment files are needed.

```sh
npm test        # Genetics, pedigree, commands, save validation and motion
npm run build  # Strict TypeScript check and production bundle
npm run check  # Both
npm run preview
```

The npm cache is configured inside this checkout for compatibility with the workspace sandbox. Generated files, the cache and dependencies are ignored by Git.

## Try the lab

1. Select a swimming fish or its collection card. Rename it and inspect its 48- or 60-locus genome, including named Genome 2 appearance alleles.
2. Choose a mother and father. Breed twenty eggs into the current tank and watch them hatch and grow.
3. Select a child, then open Family and choose a parent.
4. Review the planner's exact single-locus odds and 256-sample adult-potential ranges, then move interesting offspring to another aquarium and select them as the next parents.
5. Use unrelated NPC stock for outcrossing. Selling preserves the fish’s family record.
6. Open **Saves** to export, preview a v1/v2 import, or restore one of two backups. The app automatically reloads its validated IndexedDB save and preserves the original v1 localStorage data.

Offspring start as eggs. They hatch after 3 game days and grow toward their genetic adult length, faster in well-kept water; one game day passes per real minute. Portraits still show **adult genetic potential**. Each tank has a feeder, filter, aeration and thermostat under **Care controls**, with previews and costs; warnings name what to fix. Poor care lowers condition and slows growth, and fish never die. Motion speed does not change growth. The local NPC economy is intentionally unbalanced because lab breeding and tanks are free.

Limits: 60 residents per tank, eight tanks, 480 living fish and 10,000 total fish records including archives. A full twenty-fish cohort must fit before any birth is created.

## Project documents

| Read | Purpose |
|---|---|
| [Game design document](docs/GDD.md) | Full product vision, concept critique, gameplay, care, economy and progression |
| [Genetics specification](docs/GENETICS.md) | Exact genome v1/v2 rules, all 60 loci, color and ornament expression, rarity, pedigree, planned genome v3 expansion |
| [Architecture](docs/ARCHITECTURE.md) | Current source map, target data model, command contracts, worker/server strategy |
| [UX specification](docs/UX_SPEC.md) | Aquarium, inspector, breeding, family, market and recovery flows |
| [Balance and experiments](docs/BALANCE.md) | Implemented constants, future tuning, measurable experiments |
| [Milestone schedule](docs/ROADMAP.md) | Relative/calendar schedule, effort assumptions, critical path and release gates |
| [Task backlog](docs/BACKLOG.md) | Task IDs, estimates, dependencies, roles and acceptance criteria |
| [Implementation status](docs/IMPLEMENTATION_STATUS.md) | What actually works, limitations and first next task |
| [Testing and verification](docs/TESTING.md) | Automated/browser evidence and future validation gates |
| [Agent handoff](docs/HANDOFF.md) | Read order, commands, continuation prompts and repository conventions |
| [Decision log](docs/DECISIONS.md) | Decisions, rationale and conditions for revisiting them |
| [Original supplied concept](docs/source/original-concept.txt) | Preserved source notes |

New contributors and agents should start with [AGENTS.md](AGENTS.md), then [implementation status](docs/IMPLEMENTATION_STATUS.md).

## Technical foundation

React + TypeScript + Vite. Pure seeded genetics and pedigree core, with genome v2 color and ornament chromosomes. Procedural Canvas fish shared between live tank and portraits, including body and eye colors, fine spots, tiger stripes, marbling, calico, rosettes, scale types, shimmer and tail/dorsal patterns. A versioned Web Worker runs fixed-step visual motion. The persistent clock integrates visible, background and protected offline time, including a one-compartment water model and care (feeding, equipment, thermostat) per tank; life stages, accumulated growth and condition are active. Versioned command replay, transactional IndexedDB backups and a single-writer browser lock protect local worlds.

M2 (FS-201–206) is complete. Five human observers scored 54/60 in the M1 resemblance study (FS-111), meeting M1's human-resemblance gate. Care controls, juvenile appearance reveal, PixiJS and an authoritative database-backed market remain planned. See the [M2 runtime report](docs/research/M2-RUNTIME-AND-RECOVERY.md) and [human resemblance results](docs/research/FS-111-HUMAN-RESEMBLANCE.md).

FS-304 adds spatial steering around shared rock and plant-cover footprints. FS-403 offers exact single-locus odds and sampled offspring ranges early in the lab. M3 care/recovery and M4 normal breeding/nursery/genealogy remain unfinished. See [spatial and prediction evidence](docs/research/FS-304-403-SPATIAL-AND-PREDICTION.md).

## Repository status

Created in a clone of [ElMariones/fishtank-sim](https://github.com/ElMariones/fishtank-sim), which was empty at the start of this work. The lab is maintained on `main`; task completion and push references are tracked in [the backlog](docs/BACKLOG.md). No public deployment was performed. No license has been selected; do not infer a public reuse license from repository visibility.
