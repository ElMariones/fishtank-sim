# FS-601 — Locus registry and genome v3 migration

**Date:** 17 September 2026. **Status:** see BACKLOG (marked DONE only after a verified push). Starts M6.
**Models:** world save v10 · genome v3 · registry model 1 · structure model 1 · shop model 2 · development v5. Anatomy and renderer are unchanged; FS-602 draws structure.

## Starting state

`27794af` (FS-505 marked DONE) was HEAD and equal to `origin/main`, with no tracked changes. The baseline suite passed: 191 tests in 32 files.

## Scope

FS-601 asks for a data-driven locus registry and a genome v3 migration where old fish keep their original expression version. GENETICS §3 set the registry contract, and §8 planned genome v3 with a rule: add loci only once their expression and tests exist. FS-601 therefore adds one chromosome, the Structure chromosome that FS-602 renders, rather than all 24 planned loci.

## Delivered

**Locus registry** (`src/core/registry.ts`). There is one `LocusDefinition` per locus, in stable genome order. Each holds the locus's index and chromosome, the genome version that introduced it, and its expression kind. It also lists the supported alleles, with labels, founder weights and weighted mutation targets, plus the baseline allele older genomes read, the per-copy mutation rate and the development version that interprets it.
- `founderGenome` and `inherit` draw founder alleles and mutations from the registry. For v1 and v2 loci the registry holds the old constants. An adjacent step is two equal targets drawn with one random number, so every genome v1 and v2 birth is bit-identical to the previous code. A test keeps the pre-registry implementation as the reference.
- Save decoding checks each genome's length and every allele against the registry (`genomeProblem`).
- The genome view, allele labels and exact single-locus odds read the registry. A parent whose genome predates a locus transmits its baseline.

**Genome v3 and structure v1** (`src/core/structure.ts`). Chromosome 11, Structure, appends six loci:

| Locus | Alleles | Expression | Founder weights | Mutation |
|---|---|---|---|---|
| tail_topology | A0 standard, A1 paired fan, A2 crown-four | Recessive series: two variant copies, lower variant shown | .996 .0035 .0005 | 0.001 per copy; A0→A1, A1→A0 or A2, A2→A1 |
| lobe_balance | levels 0–5 | Additive, 0.8–1.3; baseline A2/A2 = 1 | lab standard | 0.003 adjacent |
| topology_spread | levels 0–5 | Additive 0–1, separating paired or crown lobes | lab standard | 0.003 adjacent |
| dorsal_form | A0 normal, A1 reduced, A2 absent | Recessive series | .97 .025 .005 | 0.001; A0→A1, A1→A0 or A2, A2→A1 |
| barbel_count | A0 two, A1 none, A2 four, A3 six | Two unless both copies agree; A2/A3 gives four | .965 .02 .013 .002 | 0.001; A0→A1 or A2, A2→A0 or A3, A1→A0, A3→A2 |
| fin_ray_density | levels 0–5 | Additive ray multiplier 0.76–1.36; baseline 1 | lab standard | 0.003 adjacent |

- **Separate stream:** Structure draws from its own random streams (`structure-v3:founder:<seed>`, `structure-v3:birth:<seed>`). A seed's first 60 loci, their mutations and every phenotype value except `structure` are the same as genome v2.
- **Structural mutation class:** 0.001 per copy, with only compatible neighbours as targets. A crown arises only from a paired fan, and six barbels only from four.
- **Original expression:** v1 and v2 genomes are never rewritten, and `expressStructure` returns the standard structure for them. A genome v3 record with baseline Structure alleles expresses exactly what the same genome v2 record does.
- **Offspring:** new clutches, crosses, rescues and shop stock are genome v3. Genome v1 or v2 parents pass on the baseline, so their children look standard unless a structural mutation appears. A genome v2 clutch from genome v3 parents is refused, like a genome v1 clutch from v2 parents. A command without a version uses the newest version its parents allow.

**World v10 and shop model 2.** The world schema is unchanged apart from accepting genome v3 records. `shop.model` 2 delivers genome v3 specimens, while model 1 delivered genome v2.
- **Migration:** world v9 saves decode as v10 with their shop model 1, so replaying their journals reproduces the genome v2 deliveries they recorded.
- **Rebase:** when the runtime rebases a legacy world, it moves the shop to model 2. Listings already on offer keep their genomes until sold or expired, and later deliveries are genome v3. Bare imports move at once.

**Interface.** The inspector adds a **Structure · Genome vN** block (tail, dorsal fin, barbels, with a "hidden copy" chip for carriers). Genome v1/v2 fish get a note that they keep standard anatomy. The Genome tab lists chromosome 11 with allele labels, or "not carried by genome v2" with the baseline in a tooltip. Exact single-locus odds cover all 66 loci and name categorical alleles.

## Automated evidence

Windows 11, Node 22.18.0, npm 10.9.3. `npm test`: **199 tests in 33 files** pass. `npm run build` passes (main chunk 557.04 kB, 178.22 kB gzip, with Vite's size advisory).

`tests/registry.test.ts` (8 tests):

| Fixture | Result |
|---|---|
| Definitions | 66 loci in `GENOME_LOCI` order on 11 chromosomes; founder weights and mutation targets each sum to 1; targets are supported and never the same allele; v1/v2 definitions equal the old constants; Structure baselines and rates as tabled |
| Reachability | Every supported Structure allele is reachable from its baseline by mutation steps; standard tails step only to a paired fan |
| Legacy identity | 300 seeded crosses of genome v1/v2 parents at mutation rates 0, 0.003 and 0.3 equal the pre-registry implementation exactly, mutations included |
| Genome v3 | For 200 seeds the first 60 founder loci equal genome v2. Genome v2 parents give a v3 child whose first 60 loci and mutations equal a v2 child, and with no mutation it carries the baseline. A v2 clutch from v3 parents is refused |
| Structural mutation | 20,000 births from baseline parents: 34 tail mutations in 40,000 copies (expected 40), all A0→A1, and small-effect lobe mutations in the expected range; the genome records every mutation |
| Expression | v1/v2 genomes express the standard structure object, and a v3 genome with baseline alleles expresses exactly the v2 phenotype. The recessive series, barbel rules and additive ranges are covered, and carriers are flagged. 10,000 founders: 40–130 tail carriers and at most 2 expressing (measured 76 and 0) |
| Save validation | New worlds are genome v3 and round-trip. Unsupported alleles at tail_topology and barbel_count, a short genome, a mutation outside the genome and a listing genome above its shop model are refused |
| Migration | A world v9 with genome v2 founders and a model 1 shop decodes as v10 with the same content. Its runtime, with a genome v2 courtship and a week of deliveries, replays and rebases to shop model 2 with fish, genomes and current listings unchanged. Twelve days later new listings are genome v3 and the save replays. Old parents breed genome v3 children with baseline Structure |

Existing fixtures moved to genome v3 where they breed from new worlds. Tests that record genome v2 on purpose (FS-113 legacy journals) keep genome v2 worlds. E-05, FS-505 and every economy, naming, shop, lifecycle and recovery number stayed the same, because Structure changes no trait that buyers, names or growth read.

## Browser evidence

In-app Chromium on the isolated `http://localhost:5183` (`fishtank-fs505`), with the FS-505 playtest world saved as world v9.
1. **Migration:** after reload the save read "Saved on this device" with no warning. The stored runtime was world v10 with shop model 2, six genome v2 listings kept, every fish still genome v2 and credits ◈ 1,463.
2. **Structure block:** Ember read "Structure · Genome v2", with the standard-anatomy note, "Standard single tail", "Normal" and "2".
3. **Genome view:** Ember's Genome tab read "11 / Structure · not carried by genome v2" with dashes.
4. **Instant cross:** Ember × Sumi laid 20 eggs, all genome v3, each carrying baseline Structure `022002/022002`, with no structural mutation. The egg Bruiser of the Pond showed chromosome 11 with labels ("A0 standard tail", "A2 level 2", "A0 two barbels"). Exact odds for Tail topology read "0 / 0 (standard tail / standard tail): 100%".
5. **Console:** the original tab showed two errors, "Genome v3 parents cannot produce a genome v2 child". They were raised while source edits hot-reloaded, before the prediction sampler used the parents' genome version. A fresh tab on the same save, selecting four fish, logged no errors.

## Remaining limits

- **Rendering:** structure is expressed and inspectable but not drawn yet. FS-602 adds tail topology, dorsal and barbel geometry with validators. No founder expresses a topology variant, so nothing on screen is wrong in the meantime.
- **Planned loci:** chromosome 11 implements four of its planned loci, moves `fin_ray_density` up from chromosome 12 and adds `topology_spread`. Pectoral topology, vertebral extension and chromosomes 12–14 (scale geometry, face, behavior and preferences) wait until they have expression and tests.
- **Legacy streams:** the registry does not replace the frozen v1/v2 streams; new chromosomes must keep their own streams.
- **Shop and names:** shop carriers and naming do not yet cover Structure; the rarity labels cover appearance only.
