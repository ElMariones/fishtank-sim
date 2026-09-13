# FS-103 inherited marking structure

**Recorded:** 13 September 2026  
**Models:** genome v1 · development v2 · anatomy v2 · renderer v3  
**Fixture version:** 1 (FS-101 genomes, seeds and signatures unchanged)

## Acceptance

Sibling markings share recognizable family properties. The claim is measured computationally against the previous independent placement, using fixed seeds. Whether people perceive the resemblance is FS-105's human study.

## Model

- **Haplotype blocks.** Each homolog of the Pigments and Pattern chromosomes is read as three adjacent two-locus blocks: red + yellow, black + white, reflectivity + translucency, pattern frequency + pattern scale, pattern warp + pattern symmetry, pattern edge + speckle. That gives six blocks per homolog and twelve per fish.
- **Anchors.** Each block haplotype (block, allele pair) always defines the same marking anchor: body position (u along the body, v across it), relative size, angle, warm or dark layer and display priority. Identical maternal and paternal block haplotypes merge into one anchor drawn 1.3× larger, so a fish has 6–12 anchors.
- **Count.** `pattern_frequency` still sets how many patches are drawn (3–16). Anchors are shown in priority order; counts above the anchor total add smaller satellites whose offsets are also inherited.
- **Unchanged semantics.** Pattern scale sets radius, warp sets aspect, symmetry compresses vertical spread, edge sets softness, red and black set opacity, and the melanin switch still suppresses dark pigment.
- **Birth seed.** It adds only jitter: u ±0.03, v ±0.08, radius ±12% and angle ±0.25 rad. Speckles remain birth-seed detail on their own seeded stream.
- **Attachment.** Markings are placed in body coordinates and mapped onto each fish's anatomy v2 outline, so they stay on any silhouette.

Inheritance follows directly from existing genome v1 rules. A parent passes one of its two block haplotypes to each child. A crossover at the block's internal boundary (probability 0.12) or a mutation at either locus creates a different haplotype and moves that one marking. A line homozygous for a block breeds true for that marking.

## Measurement

- **Mask.** Visible warm and dark markings are rasterized to 36 × 14 body-coordinate cells on one standard all-A2 body, so silhouette differences cannot inflate similarity. A layer counts only if its opacity is at least 12%.
- **Overlap.** Jaccard index of two masks.
- **Separation.** Probability that a related pair overlaps more than an unrelated pair (rank-based; 50% means no family signal).
- **Study.** 24 unrelated founder pairs × 10 full siblings at the lab mutation rate: 1,080 sibling pairs, 480 unrelated child pairs, 480 parent–child pairs and 480 unrelated adult–child pairs.

| Measure | Independent placement (renderer v1–v2) | Inherited anchors (development v2) |
|---|---:|---:|
| Sibling overlap | 21.1% | 41.8% |
| Unrelated child overlap | 19.3% | 28.9% |
| Parent–child overlap | 20.6% | 38.5% |
| Unrelated adult–child overlap | 18.4% | 25.2% |
| Sibling separation | 52.4% | 72.7% |
| Parent separation | 53.3% | 71.9% |

A replication with 60 families × 12 children gave sibling separation 52.8% → 72.3% and parent separation 51.8% → 71.2%.

The frozen FS-101 cohorts (Haru × Sumi and Kohaku × Yuki):

| Placement | Sibling overlap | Cross-cohort overlap | Parent–child overlap | Sibling separation |
|---|---:|---:|---:|---:|
| Independent | 21.5% | 21.3% | 21.9% | 50.5% |
| Inherited | 43.9% | 26.8% | 41.4% | 82.2% |

With mutation disabled, more than 85% of 400 children's anchors match a parental block haplotype; the 0.12 internal crossover predicts about 88%.

## Interpretation

- Independent placement carried almost no family signal. Its residual 52–53% came only from inherited count, scale and pigment visibility.
- Inherited anchors roughly double sibling and parent–child overlap and raise separation to about 72%, or 82% in the fixture cohorts. The signal is strong but imperfect: siblings still differ in segregating count, scale, symmetry and pigment visibility.
- Unrelated overlap also rose (19% → 29%). Unrelated fish share common haplotypes by chance under the single A2-heavy founder distribution, and inherited anchors are less uniformly spread than independent patches. This is a known ceiling on separation, not a measurement error.

## Intended visual differences

- Every lab fish re-renders with inherited placement. Genomes, IDs, counts, colours, softness and patch scale are unchanged; individual patch positions move relative to renderer v2.
- Dark patches now draw above warm patches.
- A homozygous block shows one bolder patch instead of two.
- Speckles use their own seeded stream, so their positions also change.

## Limits and follow-up

1. **Computational, not perceptual.** FS-105 must test recognition with people.
2. **Chance sharing by state.** Locus-specific founder distributions (GENETICS §3) would reduce unrelated overlap.
3. **Two chromosomes carry placement.** Selecting on red or black intensity also fixes nearby marking positions through linkage. This hitchhiking is intended but should be explained in the inspector.
4. **Simple shapes.** No true bilateral symmetry or reaction–diffusion; markings are ellipses.
5. **No per-fish appearance version.** Saved lab fish re-render under development v2 (ADR-019).

## Reproduction

Run `npm test`; `tests/pattern.test.ts` asserts the transmission rate and the separation thresholds. In the app, open **Visual fixtures → Inherited marking structure**. **Download JSON report** includes `patternResemblance` and `fixturePatterns`.
