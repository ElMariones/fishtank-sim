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
| ADR-018 | Anatomy v2 is a pure core geometry contract between phenotype and every renderer; renderer v2 draws it. Keep the v1 body Béziers, move anchors onto the measured outline, and limit eyes that cannot fit (with a listed adjustment) instead of letting them overhang | Attachment becomes testable without Canvas, a future PixiJS renderer can reuse the same anchors, and silhouettes do not drift. Lab records store no per-fish appearance version or archival portrait, so every lab fish re-renders under the current model; genomes, IDs and FS-101 signatures are unchanged | Per-fish expression versions and archival portraits (FS-404/FS-601), or a topology template (genome v2) that allows protruding eyes |
| ADR-019 | Development v2 derives marking anchors from phased two-locus haplotype blocks on the Pigments and Pattern chromosomes; the birth seed only jitters them; renderer v3 draws them in body coordinates | Existing v1 alleles and phase already carry inheritance, so markings travel with chromosome copies, recombine at real boundaries and move when a real locus mutates, without new loci or save fields. Measured sibling separation rose from 52% to 73% (FS-101 cohorts 51% to 82%). Lab fish re-render under the new model, as in ADR-018 | FS-105 human study fails; locus-specific founder distributions change chance sharing; genome v2 adds dedicated pattern loci |
| ADR-020 | Breeding goal, collection sort and favorites are device-local preferences under a separate validated key (`fishtank-sim.lab.v1.preferences`), not fields in world save v1 | Player annotations should not force a save-schema migration before FS-203. Missing or invalid preferences fall back to defaults and can never corrupt the world, unknown fish IDs are dropped, and a preserved unreadable world save also blocks preference writes | Import/export (FS-204) or IndexedDB persistence (FS-203) should carry annotations with the world, or favorites need to follow a world across devices |

All decisions dated 13 September 2026. They are implementation guidance, not user-approval gates. Future agents may resolve routine details within the user’s authorized scope and record evidence-driven changes here.
