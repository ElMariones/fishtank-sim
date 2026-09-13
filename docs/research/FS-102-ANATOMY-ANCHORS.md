# FS-102 anatomy anchors

**Recorded:** 13 September 2026  
**Models:** genome v1 · development v1 · anatomy v2 · renderer v2  
**Fixture version:** 1 (FS-101 genomes, seeds and signatures unchanged)

## Acceptance

No detached eyes or fins and no clipped silhouettes at the tested extremes. Changes are compared with renderer v1 on the same outline. Reference views are the in-app **Visual fixtures** surface and its JSON report.

## What changed

- **Pure anatomy contract.** `src/core/anatomy.ts` samples the unchanged v1 body Béziers into x-monotonic dorsal and ventral outlines (body-length units). It derives every anchor from local body sections and returns conservative bounds, plain-language adjustments, a validator, fish-shaped picking and portrait framing. It has no Canvas, DOM or randomness, so tests check the same geometry the renderer draws.
- **Eyes.** The v1 longitudinal position is kept if the whole orbit fits with a 0.004 BL margin. Otherwise the eye moves back up to 0.04 BL, then its radius is reduced to the largest that fits. `eye_position` selects a height within the feasible range. Every move or reduction is listed on the fixture card and in the report.
- **Fins.** Dorsal and pectoral roots sit inside the outline at fixed fractions of the local section. Free-edge controls are measured from the outline rather than the body's nominal depth.
- **Caudal fin.** The root sits on the peduncle centreline. Rays end on the trailing edge between notch and tips, bend within their fin, and are clipped to it.
- **Face.** The gill line is drawn inside the body clip. The mouth corner and barbel roots are inside the snout.
- **Framing.** Portraits are framed from anatomy bounds, which include the full tail wave, instead of a per-trait heuristic. The fixture lab adds **Shared scale**: every portrait on a board uses one pixel scale, so body length differences stay visible.
- **Tank picking.** Drawing and clicking share one pose transform. A click selects the body or caudal fin under the pointer (6 px slop), and the fish drawn on top wins.
- **Stress fixtures.** Six additional valid v1 allele states push eyes, roots, rays and framing.

## Stress fixtures

| Fixture | Birth seed | Genome checksum | Recorded adjustment |
|---|---:|---|---|
| Shallow body · large high eyes | 301001 | 5B835C8B | Eye moved 0.04 BL; radius 0.060 → 0.036 BL |
| Every locus A0/A0 | 301002 | 34759ED3 | None |
| Every locus A5/A5 | 301003 | C4F29FD3 | None |
| Sway back · domed head · long snout | 301004 | 8889CA83 | None |
| Pinched peduncle · deep body · fan tail | 301005 | 35C11CA3 | None |
| Stub forked tail · wide mouth · long barbels | 301006 | 9C1C8C53 | Eye moved 0.02 BL |

The FS-101 elongated needle fixture also records "eye moved 0.02 BL". No other FS-101 fixture needed an adjustment.

## Measured comparison

858 phenotypes: all 58 fixtures, 400 seeded founder-distribution genomes and 400 seeded genomes whose every allele copy is A0 or A5. The v1 column applies the renderer v1 anchor and framing formulas to the same outline. The v2 column counts failed anatomy validation or portrait clipping.

| Check | Renderer v1 rule | Anatomy v2 |
|---|---:|---:|
| Eye extends past the head outline | 286 | 0 |
| Dorsal fin root outside the body outline | 122 | 0 |
| Pectoral fin root outside the body outline | 858 | 0 |
| Gill line endpoint outside the body | 107 | 0 |
| Mouth line endpoint outside the snout | 84 | 0 |
| Tail ray leaves the fin | 243 | 0 |
| Portrait framing clips the silhouette | 26 | 0 |
| Phenotypes with any defect | 858 | 0 |

Anatomy v2 limited 51 eye radii (5.9%) and moved 76 eyes. The v1 pectoral rear root sat just below the belly for every phenotype. That is a thin sliver, hard to see at thumbnail size, but it is a real anchor error. An automated test repeats a 558-phenotype version of this sweep, plus a 3,008-genome validation.

## Intended visual differences from renderer v1

- Body outlines are unchanged; tests pin the snout tip and peduncle endpoints for the founders.
- Shallow-bodied or high-eyed fish show eyes lower, slightly further back or, in the listed cases, smaller.
- Gill lines are shorter and stay inside the body; tail rays follow a deep fork instead of crossing its gap.
- Portraits are centred on their bounds, so thumbnails can sit at a different size and position than in v1.
- Pattern placement is unchanged. Inherited marking structure is FS-103.

## Limits and follow-up

1. **Eye expression is bounded by head depth.** The eye-size descriptor still reports genetic potential, but in the shallowest bodies the drawn eye is smaller and the card says so. Protruding eyes need a topology template (genome v2), not a renderer exception.
2. **Picking approximates the caudal fin with a wedge.** Dorsal and pectoral fins are reached only through the slop; keyboard and collection selection remain the reliable path (FS-106).
3. **Tank edges.** A large fish near the motion bound can still extend past the tank's visible edge. That is the aquarium viewport, not portrait clipping.
4. **Human review is still pending.** Automated geometry checks and a DOM smoke check are not a resemblance or art-quality study. FS-105 owns that evidence.

## Reproduction

Run `npm test` (anatomy sweep, framing, picking and FS-101 pins). Run `npm run dev -- --port 5173 --strictPort`, open **Visual fixtures**, switch **Shared scale**, and use **Download JSON report** for the complete sweep counts and per-fixture adjustments.
