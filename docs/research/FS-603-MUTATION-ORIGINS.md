# FS-603 — Mutation-origin propagation and save-local carrier counts

**Date:** 17 September 2026. **Status:** see BACKLOG (marked DONE only after a verified push).
**Models:** world save v11 · origin model 1 · genome v3 · anatomy v3. Births, genomes and random streams are unchanged.

## Starting state

`e649b38` (FS-602 marked DONE) was HEAD and equal to `origin/main`. The baseline suite passed: 204 tests in 34 files.

## Scope

FS-603 asks for mutation-origin propagation and save-local carrier counts with declared scope. GENETICS §5 and §11 set the rules:
- a descendant inherits a mutation's provenance even without a new event of its own;
- historical and living carrier counts are separate;
- the same allele recreated by a different mutation is a different origin;
- rarity must state its population scope and must never pass hidden differences off as visible.

## Delivered

**Origins** (`src/core/origins.ts`).
- **Origin IDs:** every recorded de novo mutation is an origin named `<fish ID>/<locus><m|p>`, the fish and chromosome copy where it arose.
- **Trace:** `inherit` takes an optional trace and records which parental homolog it transmitted at every locus. It is filled beside the existing draws, so genomes and mutations are identical with or without it.
- **Descent:** a child gets a parental origin only when the homolog carrying it was the one transmitted. A new mutation at that locus and copy replaces it with the child's own origin. Instant crosses and clutch spawning both assign origins.
- **Save:** world save v11 appends `origins: { locus, copy, id }[]` to every fish. Founders, bought stock, shop specimens and rescued fish start empty.

**Validation.** A save is refused when any of these holds:
- an origin is malformed or duplicated at one position;
- it names no recorded mutation;
- the carried allele differs from that mutation's result;
- a founder carries someone else's origin;
- a recorded mutation lacks its own origin.

**Migration.** Worlds v1–v10 rebuild origins from genomes in ID order:
- each fish keeps its own recorded mutations;
- it inherits a parental origin only when its allele matches the carrying homolog and differs from the parent's other homolog, so the transmitted copy is certain;
- ambiguous transmissions are left untraced and counted;
- the runtime compares older snapshots without origins, then rebases onto the rebuilt world.

**Mutation notebook** (`mutationNotebook`). One pass over the records gives, for each origin:
- the locus and allele change, labelled for appearance and structure loci, and flagged structural when it arose on a structural locus;
- the first carrier and its generation;
- living carriers, living fish with two copies by descent, and all records, sold and rehomed fish included.

It is sorted by living carriers.

**Interface** (Genome tab, `MutationOrigins.tsx`).
- **Markers:** loci show `*` for a new mutation and `◆` for a copy inherited from a recorded mutation.
- **Mutation origins in this fish:** lists each origin with the copy it sits on, the change, a link to the first carrier (or "Arose in this fish") and its carrier counts.
- **Mutation notebook:** a collapsible list of up to 30 origins, with a scope statement. It says the counts cover this save's living fish and records only, that founders, shop stock and rescues start untracked, that sharing an origin means descent rather than the same allele, and that births before tracking were traced where certain.

## Automated evidence

Windows 11, Node 22.18.0, npm 10.9.3. `npm run check`: **209 tests in 35 files** and the strict production build pass (main chunk 566.14 kB, 181.31 kB gzip, with Vite's size advisory).

`tests/origins.test.ts` (5 tests):

| Fixture | Result |
|---|---|
| Trace | 200 seeded genome v3 crosses at mutation rate 0.05: traced and untraced results are identical; each trace has 66 sides per parent; every non-mutated allele equals the traced parental homolog. Origin IDs format and parse |
| Transmission rule | A mother's origin on her paternal copy passes only when her paternal homolog is transmitted, and a new mutation at that position replaces it with the child's origin |
| Bred lineage | Twelve seeded generations of instant crosses from the six founders, with rehoming, plus a normal clutch attempt: 486 records, 189 de novo origins and 613 inherited origin copies. Every carried origin matches its mutation's allele and descends from its first carrier. Every mutation has its own origin, and the world round-trips. Notebook counts equal a brute-force count for all 189 origins (the most widespread had 21 living carriers), sorted by living carriers |
| Validation | Refused: an origin naming no mutation, an allele changed under an origin, a duplicate position, a founder with inherited origins, a mutant without its own origin |
| Migration | A ten-generation lineage with origins removed and saved as world v10 rebuilds 393 of 542 traced origin copies. Every rebuilt origin is one the traced world recorded, and 140 ambiguous transmissions are counted; the rest descend from untraced ancestors. Fish keys keep schema order. A world v10 runtime with two crosses and six game days replays, rebases to world v11 with identical genomes, and round-trips |

Existing tests pass unchanged.

## Browser evidence

In-app Chromium on the isolated `http://localhost:5183` (the FS-505/601/602 QA save, world v10).
1. **Migration:** after reload the save read "Saved on this device" with no warning. The stored world was v11 with 66 records, and all 13 fish with recorded mutations carried their own origins.
2. **Inherited origins:** an instant cross of Linguine (mutations at loci 0 and 13, paternal copy) × Zesty Apricot of the Ferns (locus 20, maternal copy) laid 20 eggs. 13 carried Zesty's `FSH-000026/20m` on their paternal copy, several carried Linguine's origins, and new mutations got their own origins, including structural-chromosome loci 61 and 65.
3. **Genome tab:** Fiery Jellybean showed "Black ◆", and **Mutation origins in this fish** read "Black · copy from father · A0 → A1 · From Zesty Apricot of the Ferns · 14 living carriers · 14 records". The notebook listed 25 origins led by that one, including "Fin motif A0 → A1 (classic → spots)" and "Iris color A0 → A1 (natural → amber)".
4. **Wording fix:** the scope line read "70 living fishs"; it now reads "70 living fish and 86 records".
5. **Navigation:** the Zesty link opened Zesty, whose origin read "Arose in this fish".
6. **Console:** no errors.

## Remaining limits

- **Scope:** counts are local to one save and to recorded births. They are not frequencies of any wider population, and the lab reports no allele frequency from them.
- **Migration:** in older worlds, ambiguous transmissions (both parental homologs with the same allele) stay untraced, and so do their descendants' copies.
- **Mutation IDs:** origin IDs name record IDs, so an imported save keeps its own IDs; there are no global mutation IDs.
- **Notebook:** it lists 30 origins and has no search yet; FS-604 uses origins for bloodline registration.
