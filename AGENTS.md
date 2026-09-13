# Fishtank Sim — continuation guide

## Read first

1. README.md
2. docs/IMPLEMENTATION_STATUS.md
3. docs/HANDOFF.md
4. The task’s relevant specification and docs/BACKLOG.md

The GDD and architecture include planned systems. Check implementation status and source before describing a feature as complete.

## Project intent

The core promise is visible, heritable fish variation with meaningful behavior and permanent lineage. Prove Genome → Development → Phenotype → Render before investing in the online economy.

The current application is an accelerated local research lab, with 48 loci and Canvas rendering. Do not mislabel it as a biological koi simulator, a finished care game, or a multiplayer market.

## Implementation boundaries

- Keep genetics and development independent of React, Canvas, browser storage and network clients.
- Use seeded PRNG streams for simulation/genetics; never Math.random for inherited outcomes.
- Preserve chromosome phase and stable locus IDs/order. Changing semantics requires explicit model/save version handling and fixtures.
- Renderer consumes phenotype. It never breeds, mutates, sets market value or changes identity.
- Validate commands at the domain boundary. A rejected command must not partially change fish, currency, capacity or sequence IDs.
- Preserve immutable fish identity, parent links and genomes across sales/death. Names are mutable text.
- Distinguish pedigree F, locus heterozygosity, local carrier frequency, visible unusualness and market desirability.
- Keep unsupported or corrupt saves intact. Do not replace existing saves silently.
- Treat local worlds/imports as editable sandboxes. Future trusted market inventory must be server-owned.
- Keep user-facing UI honest about lab shortcuts and inactive life-history traits.

## Workflow

Use existing npm scripts and lockfile. Run appropriate core tests and npm run build for code changes. For visual/interaction changes, verify the relevant browser journey. Documentation-only changes need consistency/link checks rather than new unit tests.

Prefer a bounded task from the backlog and complete it through its acceptance criterion. Update docs/IMPLEMENTATION_STATUS.md and docs/TESTING.md with actual results. Record architectural changes in docs/DECISIONS.md. Do not mark a research gate complete based on build success alone.

No mandatory delegation or additional approval flow is introduced by this file. Follow the user’s current scope and preferences. If work is split among agents, assign disjoint file ownership and freeze the shared phenotype/genome/command contracts first.

## Useful commands

```sh
npm ci
npm run dev -- --port 5173 --strictPort
npm test
npm run build
```

See docs/HANDOFF.md for the exact recommended next task and current limitations.
