# Decision log

| ID | Decision | Rationale | Revisit trigger |
|---|---|---|---|
| ADR-001 | Build a genetics lab before the management game | Visual inheritance is the highest-risk core promise | Parent/offspring resemblance and selection tests pass |
| ADR-002 | Single React/TypeScript/Vite package | Empty repository; fast runnable proof without deployment prerequisites | Distinct build/runtime boundaries become real |
| ADR-003 | 48 loci in v1, 72 proposed in v2 | Enough variety with documented expression; stable schema | Topology and new behavioral expressions implemented |
| ADR-004 | Phased diploidy and linked meiosis | Preserve meaningful ancestry and linkage from the start | Extend map distances without destroying phase |
| ADR-005 | Pure genetics/development core | Replay, testability, worker/server reuse | Never replace with rendering-side genes |
| ADR-006 | Canvas reference renderer first | Tests procedural phenotype cheaply | Visual proof and profiling justify mesh renderer |
| ADR-007 | Instant adult offspring previews in lab | Supports rapid generational experiments | Life stages implemented in solo mode |
| ADR-008 | Explicit local-storage prototype adapter | Minimal functioning save in the starter | IndexedDB, imports, migration and multi-tab locking |
| ADR-009 | Preserve sold fish in pedigree | Identity survives ownership | Always preserve minimal lineage records |
| ADR-010 | Exact bounded pedigree matrix | Correct coefficients for small populations | More than 1,000 records / performance issue |
| ADR-011 | Honest rarity scope | Offline client lacks global statistics | Authoritative population service exists |
| ADR-012 | Separate trusted world from sandbox | Local clock/saves/genomes are editable | Never merge authorities without an explicit design |
| ADR-013 | Protected default absence | Aquarium observation should not create absence anxiety | Challenge-mode playtests |
| ADR-014 | Bounded topology templates | Readable anatomy and safe geometry over unlimited mutations | Supported template validation expands |
| ADR-015 | No real-money genetics economy in baseline | Not required for proving the game | Explicit future product decision |
| ADR-016 | No public deployment or remote push in this handoff | User asked for design, planning and skeleton | Requested release/push action |
| ADR-017 | Freeze visual fixtures in a pure core module and expose them through a report surface | Renderer changes need a reproducible before-state; keeping fixtures outside React preserves the phenotype contract and save identities | FS-102/103 replace renderer or pattern semantics after measured comparison |

All decisions dated 13 September 2026. They are implementation guidance, not user-approval gates. Future agents may resolve routine details within the user’s authorized scope and record evidence-driven changes here.
