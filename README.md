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
2. Choose an adult mother and father that share a tank, pick a nursery, and start a courtship. It reserves the nursery places, pauses with a reason if anything is wrong, and lays tracked eggs when it completes. **Instant lab cross** still lays twenty eggs at once as a research shortcut.
3. Select a child, then open Family. Follow ancestors up to six generations back or descendants forward, find any record by name or ID, and use Back to retrace your path.
4. Review the planner's exact single-locus odds and 256-sample adult-potential ranges. Filter the collection to one clutch, move the rest to another aquarium in one reviewed batch, and select the best as the next parents. **Research → Two generations** runs the whole cycle in a seeded world.
5. Open **NPC shop** for fixed founder, visible-variant and documented-carrier listings; choose a receiving aquarium for outcrossing stock. Sell surplus to the buyer with the best offer, or rehome it for free; either way the fish’s family record is preserved.
6. Open **Saves** to export, preview a v1/v2 import, or restore one of two backups. The app automatically reloads its validated IndexedDB save and preserves the original v1 localStorage data.

Offspring start as eggs. They hatch after 3 game days and grow toward their genetic adult length, faster in well-kept water; one game day passes per real minute. The tank and **Now** portraits show each fish's current stage (hatchlings have big heads and eyes, and pigment reveals over about ten game days); **Adult potential** previews its genetics. Each tank has a feeder, filter, aeration and thermostat under **Care controls**, with previews and costs; warnings name what to fix. Poor care lowers condition and slows growth, and fish never die. Motion speed does not change growth. Five NPC buyers pay for different traits within a limited daily demand, and every offer explains its price; the credits in the header open **Buyers and ledger**. Founders and bought stock never resell for more than they cost, and any hatched fish can be rehomed for free. Lab breeding and food are still free. **Habitat & expansion** offers paid extra tanks, capacity expansions and placed plants/rocks with saved position, size and rotation. Two starter tanks are included.

A **first-session guide** above the aquarium walks through selecting, naming, feeding, courting, keeping a hatched offspring, following a parent and setting a goal. Its **Show me** buttons point at each control, and **Guide** in the save bar shows or hides it. Under every fish's name, parent links and sibling and offspring counts lead into its family. If you lose every fish of one sex and cannot afford stock, the **koi rescue** in **Buyers and ledger** gives one unrelated adult of each missing sex at no cost, at most once every 10 game days.

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

M2 (FS-201–206) is complete. Five human observers scored 54/60 in the M1 resemblance study (FS-111), meeting M1's human-resemblance gate. PixiJS and an authoritative database-backed market remain planned. Care controls and juvenile appearance reveal are implemented. See the [M2 runtime report](docs/research/M2-RUNTIME-AND-RECOVERY.md) and [human resemblance results](docs/research/FS-111-HUMAN-RESEMBLANCE.md).

FS-304 adds spatial steering around shared rock and plant-cover footprints. FS-403 offers exact single-locus odds and sampled offspring ranges early in the lab. M3 is delivered: care controls with previews and warnings (FS-305), juvenile reveal and swim animation (FS-306), and a per-tank return summary plus healthy and stressed care scenarios in Research (FS-307). M4's task list is delivered: normal breeding with courtship blockers and reserved nurseries (FS-401/402), a six-generation family graph with record search (FS-404), a session kinship cache with stated founder assumptions (FS-405), and clutch selection, batch rehoming and a two-generation demonstration without instant crosses (FS-406). M5's task list is delivered: economy model v1 with NPC buyers, a credit ledger and free rehoming is delivered (FS-501). Persistent stock, shop filters and capacity-aware purchases are delivered (FS-502, pushed `3945d86`). Paid tank expansion and saved decoration placement (FS-503) are DONE, pushed `f78d007`; see [habitat evidence](docs/research/FS-503-HABITAT-EXPANSION.md). The first-session guide, the koi rescue for no-money recovery and family links under every fish (FS-504) are DONE, pushed `6335851`; see [FS-504 evidence](docs/research/FS-504-ONBOARDING-AND-RECOVERY.md). The paid-economy playtest with best-first batch sales (FS-505) is DONE, pushed `f5b1888`, completing M5's task list; see [FS-505 evidence](docs/research/FS-505-PAID-ECONOMY-PLAYTEST.md). M6 has started: a data-driven locus registry and genome v3 with a Structure chromosome (FS-601) are DONE, pushed `fb6b593`; see [FS-601 evidence](docs/research/FS-601-REGISTRY-AND-GENOME-V3.md). Paired fan and crown-four tails, reduced or absent dorsal fins and 0–6 barbels (FS-602) are DONE, pushed `0e95249`; see [FS-602 evidence](docs/research/FS-602-STRUCTURE-ANATOMY.md). Mutation origins by descent with save-local carrier counts (FS-603) are DONE, pushed `1d0d85c`; see [FS-603 evidence](docs/research/FS-603-MUTATION-ORIGINS.md). See [spatial and prediction evidence](docs/research/FS-304-403-SPATIAL-AND-PREDICTION.md).

## Repository status

Created in a clone of [ElMariones/fishtank-sim](https://github.com/ElMariones/fishtank-sim), which was empty at the start of this work. The lab is maintained on `main`; task completion and push references are tracked in [the backlog](docs/BACKLOG.md). No public deployment was performed. No license has been selected; do not infer a public reuse license from repository visibility.
