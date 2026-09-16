# FS-604 — Named bloodline registry

**Date:** 17 September 2026. **Status:** see BACKLOG (marked DONE only after a verified push).
**Models:** world save v12 · bloodline model 1 · origin model 1 · genome v3. Births, genomes and existing commands are unchanged.

## Starting state

`6f3ec8d` (FS-603 marked DONE) was HEAD and equal to `origin/main`. The baseline suite passed: 209 tests in 35 files.

## Scope

FS-604 asks for a named bloodline registry, with ancestry contribution and standard similarity shown separately. The GDD's long-term loop names registering a bloodline. GENETICS §11 keeps measures of different kinds apart: pedigree F, heterozygosity, carrier frequency and visible unusualness. Ancestry, a pedigree measure, must likewise never be merged with looking like the line, a phenotype measure.

## Delivered

**Registry** (`src/core/bloodlines.ts`, world save v12).
- **`register-bloodline { name, foundationIds, timestamp }`:** records a line `BL-000001…` with a trimmed name unique ignoring case (1–32 characters) and 1–8 distinct recorded, hatched foundation fish. It also stores a **standard** captured from the foundation at that moment:
  - the mean of the 14 normalized visible descriptors;
  - the most common tail topology, dorsal form and barbel count;
  - up to six mutation origins that every foundation fish carries.

  A lab holds at most 20 lines. Refusals change nothing.
- **`rename-bloodline { bloodlineId, name }`:** follows the same name rules.
- **World v12:** appends `bloodlines` and `nextBloodlineId` after `relief`, and older worlds start with an empty registry. Saves are refused for out-of-sequence IDs, duplicate names, unknown or repeated foundation fish, or out-of-range standards.

**Two measures, never combined.**
- **Ancestry contribution:** the expected share of a fish's genome from the foundation, using recorded parents only. A foundation fish is 1, other founders and unrecorded parents are 0, and every other fish is half of each parent's share. Records are processed in ID order.
- **Standard similarity:** a comparison of the fish's adult genetic phenotype with the standard, whatever its ancestry, reported with its parts:
  - shape: `1 − mean descriptor difference / 0.30`, floored at 0;
  - structure: matches out of 3;
  - signature origins carried, when the standard has any.

  The overall score weights shape 0.6, structure 0.25 and origins 0.15, and the weights are renormalized without origins.

**Calibration.** On 400 seeded genome v3 pairs, the median mean descriptor difference was 0.17 between unrelated founders, 0.105 between full siblings and 0.12 from parent to child. The first raw scale (`1 − difference`) scored every koi near 90%: in the browser, the unrelated Ember read 94% against a 100%-ancestry descendant at 92%. The 0.30 tolerance spreads that out. Over 150 seeded families, a child's shape similarity to a one-parent standard averaged 58.5%, against 41.4% for an unrelated founder.

**Interface.**
- **Batch bar:** **Register bloodline from N** appears for 1–8 hatched selected fish. Its review explains both measures, shows the standard's structure and any shared origins, lists the foundation and asks for a name.
- **Family tab, Bloodlines:** for every line, the fish's **Ancestry N%** (or "No recorded ancestry") and **Similarity N%** with shape, structure and origins shown separately. A text explains that a lookalike can match without ancestry and a descendant can drift.
- **Registered lines:** ID, foundation, standard structure, living fish with ancestry, mean ancestry, mean similarity, a link to the closest living member, and **Rename**.

## Automated evidence

Windows 11, Node 22.18.0, npm 10.9.3. `npm run check`: **215 tests in 36 files** and the strict production build pass (main chunk 576.18 kB, 184.26 kB gzip, with Vite's size advisory).

`tests/bloodlines.test.ts` (6 tests):

| Fixture | Result |
|---|---|
| Ancestry | Records in reverse order: foundation 1, founders 0, child 1/2, backcross 3/4, outcross grandchild 1/4, their cross 1/2, a child of an unrecorded parent 3/8. A two-fish foundation gives the child 1 and the grandchild 1/2 |
| Registration | A trimmed name, sequential ID and registration time are stored. The standard descriptors equal the foundation means, with standard structure and no signature. A single-fish foundation matches its own standard at 100%, and the save round-trips. Refused without change: a duplicate name ignoring case, a blank name, nine foundation fish, a repeated fish, an unknown fish, an egg, a 21st line, and a rename to an existing name or unknown line |
| Separation | An unrelated fish with Haru's genome has 0 ancestry and 100% similarity. Children of Haru have exactly 1/2 ancestry and grandchildren 1/4, while their similarity varies below 100%. Summaries count living fish with ancestry, name the closest member and average contributions exactly |
| Calibration | Over 150 seeded families, children's shape similarity exceeds unrelated founders' by more than 10 points, both within 20–80% |
| Structure and origins | A mixed foundation takes the majority tail (paired). Origins carried by every foundation fish become the signature. A paired-tail carrier of the signature scores structure 1 and origins 1; a standard-tail fish without it scores 2/3 and 0, and lower overall |
| Persistence | Refused: a registry ID at or above the next number, an unknown foundation fish, a duplicate name, an out-of-range descriptor. A world v11 migrates to an empty registry with the same key order. A runtime with registration and rename replays, and a tampered name fails replay |

## Browser evidence

In-app Chromium on the isolated `http://localhost:5183` (the continuing QA save).
1. **Migration:** the save loaded as world v12 with "Saved on this device".
2. **Register:** in Breeding Studio, selecting Linguine and Zesty Apricot of the Ferns showed **Register bloodline from 2**. The review explained both measures, read "Standard: standard tail, dorsal fin and two barbels." and listed both fish. Naming it "Jellybean Black" and confirming read "Jellybean Black registered with 2 foundation fish."
3. **Family tab:** their child Fiery Jellybean read "Ancestry 100% · Similarity 92% · shape 88% · structure 3/3". Registered lines read "42 living with ancestry · mean ancestry 76% · mean similarity 92% · closest Linguine 96%".
4. **Rename:** **Rename** to "Jellybean Ink" read "Bloodline renamed." The unrelated Ember read "No recorded ancestry · Similarity 94% · shape 91%", which led to the calibration above.
5. **After calibration and a reload:** the rename was kept. Ember read "No recorded ancestry · Similarity 78% · shape 69% · structure 3/3" and Fiery Jellybean "Ancestry 100% · Similarity 72% · shape 60% · structure 3/3". The registry read "mean similarity 73% · closest Linguine 86%".
6. **Phone:** at 390 × 844 the page was 390 px wide and the bloodline rows stacked at 346 px. The viewport was reset. No console errors.

## Remaining limits

- **Fixed standards:** a standard cannot be edited; register a new line to change it.
- **Structure scores:** matches out of 3 inflate similarity when the standard is itself standard structure, since most koi match.
- **Descriptors:** shape uses the 14 legacy visible descriptors, not colour or ornament.
- **Ancestry:** unrecorded parents count as unrelated.
- **No external meaning:** bloodlines do not affect prices, NPC demand or names.
- **Scale:** summaries walk every record for every line (at most 20 lines × 10,000 records per Family-tab render of the registry).
