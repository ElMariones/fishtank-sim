# FS-101 visual fixture baseline

**Recorded:** 13 September 2026  
**Fixture version:** 1  
**Models:** genome v1 · development v1 · renderer v1  
**World seed:** 481516  
**Fixed timestamp:** 2026-09-13T12:00:00.000Z

## Purpose

This is the reproducible before-state for later anatomy and inherited-pattern work. The in-app **Visual fixtures** surface renders the same data and can download a JSON copy. Opening it does not read from or write to the player’s world.

The baseline contains:

- all six fixed founders;
- Haru × Sumi and Kohaku × Yuki, with twenty deterministic children each;
- six valid v1 extremes covering long/deep bodies, head and eye extremes, snout length, broad fan tails, and deeply forked tails;
- fourteen visible descriptors normalized against their theoretical development-v1 ranges.

## Frozen identities

| Fixture | Birth seed | Genome checksum |
|---|---:|---|
| Haru / FSH-000001 | 47017952 | C27C49D6 |
| Sumi / FSH-000002 | 97350809 | CA682453 |
| Kohaku / FSH-000003 | 80573190 | AFBCAA66 |
| Yuki / FSH-000004 | 130906047 | C71392BD |
| Akira / FSH-000005 | 114128428 | 8D3D1E0A |
| Momo / FSH-000006 | 164461285 | 52583B8E |
| Cohort A / 20 children | 101001 | aggregate BD215114 |
| Cohort B / 20 children | 101002 | aggregate 39528E26 |
| Elongated needle body | 201001 | 4E05DD5B |
| Deep disk body | 201002 | 9186E69B |
| Domed head · small eyes | 201003 | F1AE3CEB |
| Broad fan tail | 201004 | E3EF315B |
| Long snout · large eyes | 201005 | A53F929B |
| Long deeply forked tail | 201006 | 78F597E3 |

Aggregate cohort checksums are FNV-1a hashes of the twenty ordered child genome checksums. They are regression pins, not cryptographic provenance.

## Cohort measurements

Values are normalized percentages of declared v1 descriptor ranges. The full surface and JSON report include parent values plus child minimum, mean, and maximum.

| Descriptor | Haru | Sumi | A min | A mean | A max | Kohaku | Yuki | B min | B mean | B max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Body length | 40 | 60 | 40 | 47 | 60 | 30 | 40 | 20 | 36 | 50 |
| Body depth | 30 | 50 | 20 | 38 | 60 | 10 | 50 | 20 | 31 | 40 |
| Head size | 32 | 19 | 18 | 24 | 35 | 15 | 13 | 0 | 17 | 30 |
| Eye size | 30 | 50 | 10 | 52 | 70 | 60 | 30 | 30 | 49 | 60 |
| Tail length | 15 | 23 | 7 | 20 | 32 | 49 | 29 | 28 | 41 | 52 |
| Tail spread | 50 | 40 | 30 | 47 | 70 | 20 | 50 | 20 | 31 | 50 |
| Pattern count | 38 | 54 | 23 | 58 | 69 | 54 | 54 | 38 | 50 | 54 |
| Pattern scale | 20 | 40 | 20 | 32 | 40 | 40 | 30 | 20 | 35 | 50 |

Values outside the two displayed parent phenotype values can be valid. Each parent has two phased allele copies, recombination selects one, regulatory loci interact, and the lab mutation rate remains active.

## Visual inspection

Checked in the local Chromium-based Codex browser at the default desktop viewport and at 390 × 844:

- all 56 Canvas portraits rendered and no error overlay appeared;
- founder, cohort, measurement, and extreme sections were reachable through keyboard-addressable controls;
- the phone layout had no document-level horizontal overflow;
- no browser console warnings or errors were recorded;
- no tested silhouette was clipped and the tested eyes/fins remained attached.

This is a rendering smoke check, not a human resemblance study and not completion of the M1 research gate.

## Findings and follow-up

1. **Morphology inheritance is measurable.** The two cohorts occupy distinct normalized ranges, especially in tail length: cohort A mean 20% versus cohort B mean 41%.
2. **Portrait auto-fit weakens perceived body-size comparison.** Every portrait is scaled to its own overall bounds, so a 0% versus 100% length case is less obvious than the descriptor says. FS-102 should add a shared-scale or measurement-grid comparison mode before judging silhouette selection.
3. **Extreme fin geometry remains coherent but visually dominates.** The 100% fan and fork cases stay attached and unclipped, but the fixed peduncle/fin anchors need deliberate review under FS-102 rather than being accepted from one viewport.
4. **Sibling marking placement is not inherited.** Pattern count, scale, pigment, edge, warp, and symmetry tendencies are inherited, but patch coordinates come from each child’s independent birth seed. The contact sheets therefore expose weak family resemblance. FS-103 should introduce bounded inherited low-frequency pattern structure and retain birth-seed microvariation.
5. **No topology claim is made.** All six extreme cases use existing A0–A5 states. Crown tails, extra fins, and other genome-v2 structures remain unimplemented.

## Reproduction

Run `npm test` to verify fixture signatures and normalized bounds, then `npm run dev -- --port 5173 --strictPort` and open **Visual fixtures**. Use **Download JSON report** for the complete genomes, phenotypes, seeds, descriptor definitions, and cohort summaries.
