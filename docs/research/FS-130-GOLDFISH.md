# FS-130 Goldfish: research, design and implementation

16 October 2026 · user request: "investigate, understand and detail goldfish, design how to integrate them with a whole set of genomes and genetics, mutations, proportions, colors… code the whole new species and integrate it into the game and gameflow."

Goldfish join koi and axolotls as the third species, in world v17. They have their own 72-locus genome, their own anatomy and renderer, a shop counter, buyers, shows, names, Genome Atlas and juvenile development. Everything is in the live game: you can buy them, breed them, watch fry hatch bronze and color up, sell them and show them.

This document has three parts: what real goldfish are, how the game models them, and what was verified.

## 1. The real animal

### Origin and domestication

The goldfish (*Carassius auratus*) is a domesticated carp from East Asia. Its wild ancestor, the Prussian or gibel carp, is olive-bronze. Over more than a thousand years of breeding in China, later in Japan and Europe, keepers selected rare red and yellow mutants, then body, fin, eye and head forms. The result is one of the most diverse domestic animals: about 300 named strains, ranging from torpedo-shaped single-tailed commons to egg-shaped fish with no dorsal fin, eyes on stalks and fleshy hoods.

Goldfish are allotetraploid. A whole-genome duplication shared with common carp left two subgenomes that have since diverged. That matters for breeders: many genes exist twice, so a mutation in one copy can change form without being lethal, which is part of why goldfish tolerate so much morphological change.

### What is known about the genetics

These are the findings the game borrows from, with how confident each is:

| Trait | Gene or locus | Inheritance | Notes |
|---|---|---|---|
| Twin tail | *chdA* (chordin A, also called *chdS*), stop mutation E127X | Recessive | The duplicated caudal fin comes from a premature stop in one of two chordin copies. It arose early in domestication and is shared by ryukin, oranda and ranchu strains ([Abe et al. 2014](https://pmc.ncbi.nlm.nih.gov/articles/pmid/24569511); [OMIA 002767](https://www.omia.org/OMIA002767/7957)). |
| Telescope eyes | *lrp2* (*lrp2a*) | Recessive | Three independent mutations (a retrotransposon insertion and two nonsense mutations) each cause telescope eyes; CRISPR knockouts reproduce the trait. |
| Celestial eyes | *lrp2* | Recessive | A further, independent *lrp2* mutation gives upward-turned eyes ([LRP2 telescope and celestial eyes](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12608239/)). Independent alleles of one gene do not complement each other. |
| Transparent scales | T locus (candidate: a tyrosine-protein kinase receptor gene) | Incompletely dominant | tt metallic, Tt nacreous (the calico ground), TT matte ([Goldfish Council](https://www.thegoldfishcouncil.org/post/transparency-mutations-in-goldfish); [PMC7703540](https://pmc.ncbi.nlm.nih.gov/articles/PMC7703540)). Two nacreous parents give about 1 metallic : 2 nacreous : 1 matte. |
| Dorsal-fin loss | Polygenic; *lrp6* and others proposed | Complex, recessive tendency | Reciprocal crosses of egg-type and wen-type fish give different F1 proportions, which the authors read as several loci with maternal effects. |
| Long fins | *kcnk5b* (candidate) | Dominant | A potassium channel; in zebrafish, comparable variants lengthen every fin. |
| Juvenile color | Not mapped | — | Goldfish hatch olive-bronze and most later lose their dark pigment ("color break" or de-coloring), usually within the first months; some never do. |
| Albinism | Recessive | Recessive | Pink-eyed fish without melanin. |

Hoods (wen), bubble-eye sacs, pearl scales, pompons (narial bouquets) and curled gill covers are known from breeders' crosses. Their inheritance is described as polygenic or as single genes depending on the source; the game treats them as game rules (see section 2).

### Varieties a breeder recognizes

| Group | Varieties | Defining features |
|---|---|---|
| Single-tailed | Common, comet, shubunkin, tamasaba | Slim (commons, comets), long forked tail (comet), nacreous calico (shubunkin), single-tailed but ryukin-bodied (tamasaba) |
| Twin-tailed, with dorsal fin | Wakin, fantail, ryukin, veiltail, tosakin | Slim twin tail (wakin), egg body (fantail), hump behind the head (ryukin), long square-edged fins (veiltail), a horizontally flared fan tail (tosakin) |
| Hooded | Oranda, lionhead, ranchu | Hood with dorsal (oranda); hood without dorsal (lionhead); hood, no dorsal, curved back and drooping tail (ranchu) |
| Without dorsal fin | Egg fish | Round, no dorsal, no hood |
| Eye forms | Telescope, black moor, butterfly telescope, celestial eye, bubble eye | Protruding eyes; black velvet telescope; telescope with a butterfly tail; upward eyes; fluid sacs under the eyes |
| Scale and head forms | Pearlscale, crown pearlscale, pompon | Domed scales; with a hood; fleshy nasal pompons |

### Care facts that shape the design

- Fancy, round-bodied goldfish often have buoyancy (swim bladder) trouble and float tilted.
- Telescope, celestial and bubble-eyed fish see poorly and compete badly for food.
- Pond keepers keep hardy single-tailed goldfish; twin tails and eye forms do not survive in ponds.
- Goldfish are prolific and shoal loosely; they root along the substrate when foraging.

## 2. The game model

Synthetic rules for a game, inspired by real mechanisms. The lab does not claim to simulate goldfish biology; the inspector says which loci borrow from known genes.

### Genome

`src/core/goldfishCatalog.ts` defines goldfish genome v1: **72 loci on 12 chromosomes of 6**, two phased copies, six catalog alleles per locus, map positions 0–60 cM within each chromosome. Goldfish are **Genesis-native**: every goldfish genome carries a development block (development seed, genetic load and open-ended allele definitions) from the start, so dominance, load, vigor and new alleles all apply. No goldfish locus, allele ID, chromosome or random stream is shared with koi or axolotls.

| # | Chromosome | Loci |
|---|---|---|
| 1 | Body plan | body length, body depth, egg roundness, back arch, peduncle thickness, adult size |
| 2 | Head and hood | head width, snout, mouth, hood growth A, hood growth B, hood extent |
| 3 | Eyes | eye size, **eye program (lrp2)**, eye protrusion, **bubble sac program**, bubble size, iris |
| 4 | Fins | **long fin (kcnk)**, fin length, dorsal loss A, dorsal loss B, dorsal height, fin edge |
| 5 | Caudal fin | **twin tail (chdA)**, tail split, tail spread, tail fork, tail carriage, paired anal fin |
| 6 | Scales | **transparency (T)**, pearl scale, scale size, reflectivity, scale outline, sparkle scales |
| 7 | Pigment cells | melanophores, xanthophores, red depth, **albinism**, **blue**, **chocolate** |
| 8 | Color change | color break, break completeness, white spread, black persistence, lavender dilution, yellow shift |
| 9 | Pattern | pattern (solid, sarasa, redcap, panda, calico, tri-color), patch size, coverage, edge, symmetry, fin color |
| 10 | Ornaments | **pompon**, pompon size, **gill curl**, crown tint, nacreous blue, fin ray stiffness |
| 11 | Life history | growth rate, longevity, metabolism, fertility, maturity timing, swim bladder |
| 12 | Behavior and development | activity, boldness, sociability, foraging, canalization, vigor |

### How copies combine

| Rule | Loci | What the player sees |
|---|---|---|
| Recessive switch | twin tail, eye program, bubble sacs, albino, blue, chocolate, curled gills | Two variant copies show the trait. One copy is a hidden carrier, listed once the fish is sequenced. |
| Allelic series without complementation | eye program | Two telescope alleles (dm-1, dm-2) and one celestial allele (ce). Any two variant copies give protruding eyes: two celestial copies gaze upward; a telescope and a celestial copy give a **skygazer**, a game-only intermediate. |
| Dominant | long fin, pompon | One copy shows it; two make long fins veil-length. |
| Incompletely dominant | transparency (T) | 0 copies metallic, 1 nacreous, 2 matte; a nacreous × nacreous cross segregates about 1 : 2 : 1. |
| Threshold with a parent-of-origin effect | dorsal loss A and B | Loss alleles are recessive-leaning ("lower dominant"); the **mother's copy weighs 60%** and the father's 40%, plus developmental noise. Above a threshold the dorsal fin is absent, just below it a remnant spike. Reciprocal crosses therefore give different results, as reported for real egg × wen crosses. |
| Two-locus threshold | hood A and B | Higher alleles dominate. A hood grows only when both loci together pass a threshold; extent sets crown, cheeks or full face. |
| Categorical | iris, pattern | Iris: the darker allele is dominant. Pattern: sarasa and calico are dominant over solid; redcap, panda and tri-color are hidden behind a solid copy and need two copies. |
| Quantitative (Genesis dominance) | everything else | Potency-weighted: additive, higher-dominant, lower-dominant, or overdominant (fertility, longevity, vigor). |

Mutation is 0.0015 per copy per locus (switch loci 0.55×, categorical 0.75×). A loss-of-function variant mostly arises from the neighbouring wild allele. As in Genesis koi and axolotls, 42% of mutations at quantitative loci create an **open-ended allele** with its own value, potency and up to two side effects, named after the fish it arose in.

Genetic load uses its own 40-site catalog (lethal, frail, subfertile, dwarf, spine, fin erosion, eye, pigment and gill defects), anchored across the goldfish genome and never homozygous in founders.

### Development: from genome to fish

`expressGoldfish` (in `src/core/goldfishGenetics.ts`) turns a genome into adult potential:

- **Body:** length, depth, egg roundness, back arch and peduncle; round bodies are a little shorter.
- **Tail:** two chdA copies give a tri-tail (upper lobes joined), twin or four-lobed tail depending on tail split; a carrier with an extreme split modifier occasionally shows a tri-tail (incomplete penetrance). Twin tails with a wide spread are butterfly tails; long fins with an unforked edge are veil tails; carriage sets the ranchu droop.
- **Head and eyes:** hood size and extent, pompons, curled gills, eye kind and protrusion, bubble sacs.
- **Scales:** metallic, nacreous or matte; pearl domes; reflectivity, outlines and sparkle scales.
- **Color:** see below.
- **Variety:** the fish is classified by fixed precedence (bubble eye → celestial/skygazer → telescope/black moor/butterfly → pompon → pearlscale → no dorsal (ranchu, lionhead, egg fish) → oranda → twin tails (tosakin, veiltail, wakin, ryukin, fantail) → single tails (shubunkin, comet, tamasaba, common)) and named with its color, for example "Redcap lionhead" or "Calico shubunkin". Each variety has a **standard score** (0–100%) for how close the fish comes to that variety's ideal, minus visible defects, buoyancy trouble and asymmetry.

#### Color

Goldfish hatch bronze. Each fish has a **break day** (8–38 days after hatching, from the color-break locus; higher alleles break earlier and dominate). Fish with the lowest color-break alleles never break and stay wild bronze. After the break:

- dark pigment falls by the break completeness, except what black persistence keeps (black moor, panda);
- white spread removes orange in patches (red and white, sarasa), or entirely (white, platinum);
- red depth and yellow shift set the hue from blood red through orange to lemon;
- blue, chocolate and lavender change what the remaining dark pigment looks like; albino removes it and turns the eyes pink;
- calico needs nacreous or matte scales to show its blue ground. A calico allele under metallic scales is listed as a hidden copy, not as a visible pattern.

#### Juvenile stage

`stageGoldfish` in `src/core/juvenile.ts` stages the adult phenotype by life state: fry are slimmer with big eyes and short fins; hoods grow in late (by the square of body maturity), telescope eyes and bubble sacs develop with the body; color stays bronze with dark mottling until the break day, then fades into the adult color over 6 days.

### Trade-offs and behavior

| Trait | Cost or effect |
|---|---|
| Deep, round bodies with a weak swim bladder | Buoyancy trouble: the fish floats head-down (drawn and picked tilted), swims at 75% speed, drifts toward the surface, condition capped at 78%, offers fall to 60%, shows deduct presentation. |
| Telescope / celestial / skygazer / bubble eyes / a hood over the whole face | Vision limit 30–100%: wins less contested food. |
| Twin tails, long fins, butterfly tails, bubble sacs | More drag, slower swimming; long fins cost a little oxygen. |
| Curled gills (or a gill defect) | 25% more oxygen demand. |
| Foraging, boldness, activity | Win more contested food. Goldfish root along the substrate when foraging and hover rather than cruise. |
| Fertility, vigor, load | Clutch size, as for other Genesis animals. |

### Gameflow

| Surface | Goldfish behavior |
|---|---|
| NPC shop | A third counter (5 places, same delivery rhythm): domestic founders ◈ 220, fancy varieties bred to a standard ◈ 290 / 380 / 490 by rarity, documented carriers of a recessive ◈ 320. Stock is fixed per listing and derives from the world seed. |
| Buyers | Pet shop takes any goldfish. The pond keeper takes only hardy single-tailed goldfish of 16 cm or more. The long-fin collector wants long fins, butterfly or veil tails. The miniature keeper wants adults of 13 cm or less. The color collector wants uncommon varieties and rare colors (albino, blue, chocolate, lavender, calico, tri-color, panda, redcap). |
| Breeding | Normal courtship and fast breeding both work; goldfish only breed with goldfish. The planner previews a pair: exact odds for every recessive once both parents are sequenced, and a 256-sample variety, color, size and buoyancy mix. |
| Shows | Six goldfish shows per 30-day window, one per tier. Presentation scores the variety standard, symmetry and fin quality; pattern scores color richness, patch edges and sheen; condition as for other species. Rivals above the amateur tier are show-bred to a variety. |
| Genome Atlas | A goldfish tab; clutches add evidence and linkage as for koi and axolotls. |
| Names | An independent vocabulary keyed to variety, color, eyes, hood, tail and temperament (Kingyo, Ranchu, Demekin, Hanafusa, Tancho…). |
| Visual fixtures | A goldfish board: every breed standard on one founder background plus six unselected founders. |

### Founder statistics

Measured over 2,000 founder genomes during tuning (not a test assertion):

- Varieties: common 62%, fantail 7%, comet 6%, shubunkin 4%, egg fish 4%, pearlscale 4%, pompon 3%, tamasaba 3%, wakin 3%, ryukin 2%, oranda 1%, and under 1% each telescope, veiltail, skygazer, ranchu, bubble eye, crown pearlscale, tosakin and celestial.
- Colors: orange 38%, red and white 31%, red 11%, calico 5%, bronze 5%, panda 3%, platinum 2%, red and black 2%, other colors under 1.5% each.
- Tails: single 87%, twin 12%, tri 1%. Dorsal: full 88%, remnant 7%, absent 4%. Scales: metallic 69%, nacreous 28%, matte 3%. Buoyancy trouble 6%. Adult length 11–31 cm, mean 20 cm.

So a new player sees mostly commons, while carriers make twin tails, hoods and eye forms appear within a few generations.

## 3. Verification

- `tests/goldfishGenetics.test.ts` (15 tests): deterministic, valid founders that never express their own load; malformed genomes rejected; traced inheritance and species separation; open-ended alleles stay valid; carrier × carrier gives 18–32% twin tails, every homozygote twin-tailed and under 8% of carriers; lrp2 non-complementation (telescope, celestial, skygazer, carrier); T locus 1 : 2 : 1; long fins dominant and slower; reciprocal dorsal crosses differ by more than 40 of 200; hoods need both loci and grow in late; fry bronze before the break day and adult-colored after; buoyancy; vision costs food competition; each breed standard yields its variety on at least 18 of 30 founder backgrounds.
- `tests/goldfishIntegration.test.ts` (12 tests): a new world opens with a valid goldfish counter and empty goldfish atlas and round-trips through `decodeSave`; buying a listing is atomic and ledgered; the counter refills without changing koi or axolotl stock; instant and courtship breeding, atlas evidence and a runtime replay; a world v16 save migrates to v17 and a v16 runtime rebases; a species/genome mismatch and a tampered price are rejected; pond keeper and rarity rules; goldfish shows, judging and entry round-trip; deterministic mixed-tank behavior; anatomy bounds, picking and portrait framing for every variety; drawing through the shared entry point.
- Browser journey: see [testing](../TESTING.md#fs-130-goldfish).

## 4. Limits and open questions

- The numbers (founder weights, thresholds, prices, show weights) are first tunings, not playtested balance.
- Goldfish never die, like every animal in the lab; buoyancy trouble and weak vision cost condition, food and value only.
- Cold hardiness, temperature-driven deshing and seasonal spawning tubercles are not modelled.
- Bloodline registration and koi breeding goals remain koi-only; goldfish pedigree, F and family trees work fully.
- Once players have goldfish saves, the goldfish catalog, expression and name vocabulary are frozen like the other species: changing them changes replayed births and fails replay validation (this was observed during development, in a throwaway save). Changes need a new goldfish genome or naming version.
