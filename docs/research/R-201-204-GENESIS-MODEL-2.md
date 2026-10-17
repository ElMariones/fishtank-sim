# R-201–R-204: Genesis model 2, the Allele Registry, the Codex, module anatomy and the PixiJS fish layer

17 October 2026 · user request · world v18 · development v7 · renderer v9

The user asked for three things in order: an analysis of the genomes with additions that bring more variety,
randomness and unique animals; then the revamp report's Phase 2 items R-201 to R-204; and, mid-way, a rarity view for
every species like the koi appearance panel (common → legendary), so that special animals and animals worth crossing
stand out. This report records what was found, what was built and how it was checked.

## 1. Genome analysis

What FS-129 and FS-130 already gave each species (koi genome v4, axolotl genome v2, goldfish genome v1, all 72 loci):
dominance by allele potency, epistatic switches, pleiotropy, genetic load, developmental noise, and open-ended alleles
with 0–2 side effects on 12 channels. Reading the code and sampling births showed five gaps in variety:

| Gap | Evidence | What was added |
|---|---|---|
| New alleles were almost all small steps | `createNovel` steps 0.35–1.6 levels (koi) with a quadratic bias toward the small end; dominance changes only by ×0.55–1.5 | **Allele kinds**: about 1 in 8 new alleles is a *leap* (2.2–3× the step, plus an extra side effect) and 1 in 8 is *regulatory* (value barely moves, potency ×0.32 or ×1.85: dominance flips) |
| Side effects never touched body shape, eyes, pattern contrast or lifespan | the 12 channels are color, glow, sheen, size, speed, metabolism, boldness, fertility, maturity, growth, pattern density and fins | four new channels: **body depth, eye size, pattern contrast, lifespan** (model 2 only, interpreted per species) |
| Body plans were fixed | every koi has one dorsal fin; every axolotl three gill rami | **module genes** on a new Body plan chromosome (R-203) |
| Identical genotypes looked nearly identical | developmental noise only scales existing parts | **somatic marks**: a mosaic sector (2–7%, more likely with low canalization) or a birthmark (7%); never inherited |
| Founders could not carry structural surprises | module genes did not exist | old genomes have a **latent module genotype** read from their fingerprint, so a founder can turn out to carry a second dorsal fin in its Genesis-bred young |

Everything above is *Genesis model 2*. Model 1 (every journal recorded before world v18) is untouched.

## 2. Compatibility design (world v18)

Saves are proven by replaying their journal and comparing the result byte for byte, so a change to how births work
would make every existing save fail. The established fix is a version that the replay can read. Here it is a world
field, `genesisModel`, rather than three new genome versions:

- A world v1–v17 save migrates at **model 1** (empty Codex, atlas padded from 72 to 78 loci), replays its journal
  exactly as before, and then **rebases to model 2**. On that rebase the Codex credits the animals it already bred.
- New live worlds start at model 2; research harnesses (`createWorld` default, genome v3) stay at model 1, so recorded
  pacing evidence is unchanged.
- `inherit(…, model)` first runs the model 1 meiosis with the same streams and draws, then, under model 2,
  `upgradeChild` adds module genes and enriches only the alleles that arose in this birth, each from a stream keyed by
  its own ID. A model 2 child therefore has exactly the model 1 child's 72 locus arrays (tested).
- Model 2 genomes carry `genesis.model: 2` and `genesis.modules`; their fingerprint includes the module genes. Allele
  side effects keep canonical order (`CHANNELS` then `EXTRA_CHANNELS`), so model 1 effects serialize unchanged.
- Body plan atlas loci are observed, and Codex discoveries recorded, only under model 2, so model 1 journals reproduce
  their atlas and Codex exactly.

## 3. R-201 Open-ended alleles and the Allele Registry

The registry existed (FS-129) as a name list. It now reads each allele's full definition from the genome of the animal
it arose in (`alleleRegistry.ts`) and shows, per allele: its kind, the allele it mutated from (catalog label or registry
name), how many derived alleles descend from it and its lineage depth, its value shift on the locus scale, side
effects, living carriers and homozygotes, and its share of copies at its locus among living animals. The Atlas tab
filters by living, lost, leap and regulatory, sorts by newest, carriers or lineage depth, and searches by name. Lost
alleles stay listed. No new saved fields were needed: definitions travel in genomes, which are immutable.

## 4. R-202 Genome Atlas (discovery mode) and Codex

The discovery Atlas existed (FS-129). Added:

- **Chromosome 13, Body plan**: the six module loci per species (none for goldfish yet) with their own evidence and
  rule text (threshold, modifier, recessive, dominant).
- **Codex** (`codex.ts`, world v18 `codex`): 24 koi, 17 axolotl and 30 goldfish named phenotypes on the rarity ladder
  (uncommon → legendary). The first bred animal that shows one is credited with the day. Undiscovered entries show the
  hint text so players know what to aim for. Keys are save data and frozen.
- **Clutch ratios** (`segregation.ts`): for families of at least six visible young, classes of switch-like traits are
  counted and tested against 1 : 1, 3 : 1, 1 : 3, 15 : 1, 1 : 2 : 1 and related ratios with a χ² test at 95%, with a
  plain-language hypothesis. It uses only phenotypes, so it works in discovery mode.

## 5. R-203 Module-graph anatomy

`modules.ts` defines module loci per species, latent genotypes, linked inheritance (crossover 0.18, mutation 0.005 per
copy, one allele step), threshold expression with noise that canalization narrows, somatic marks and `bodyPlanFor`,
which reads any phenotype as a graph of modules with origins (standard, duplication, transformation, novel, reduced).

| Species | Module | Rule | Rendering |
|---|---|---|---|
| koi | second dorsal fin | liability (two copies + modifier + noise ≥ 3.4) | anatomy `modules.dorsal2`; the first dorsal shortens |
| koi | wen | liability (≥ 3.4) | lobed cap riding the dorsal outline |
| koi | bubble eye | recessive, size modifier | translucent sac under the eye |
| axolotl | fourth gill ramus | recessive | `gillStalkCount` 4 |
| axolotl | polydactyly | liability (≥ 3 one digit, ≥ 4.6 two) | digit counts, capped at 7 |
| axolotl | dorsal crest | dominant, height and reach modifiers | dorsal membrane starts nearer the head and rises |

Trade-offs: a second dorsal adds drag, a wen lowers food competition, bubble sacs slow the fish and cap condition at
92%, a crest adds drag, extra rami raise oxygen uptake. Measured over 3 000 model 2 births from unrelated founders per
species: 6.5% of koi show a module (second dorsal 2.5%, wen 2.9%, bubble eyes 1.1%) and 7.0% of axolotls (crest 4.2%,
polydactyly 1.6%, fourth ramus 1.3%). A line fixed for high dorsal liability shows a second dorsal in more than half
its young. Two tuning passes lowered the first draft's 9.5% and 11.7%. Anatomy bounds include every module point, so picking, portraits and sprites frame them.

## 6. R-204 PixiJS renderer migration

FS-701 recorded PixiJS as the escape hatch with identical pixels. Renderer v9 ships it for the fish layer:

- The aquarium is three stacked layers: the Canvas 2D aquascape (back plants, eggs, motes, bubbles, food), the **Pixi
  fish layer**, and a Canvas 2D front layer (front plants, glass, the selection halo and name pill).
- Pixels still come from `drawFish`. Fish below the sprite threshold use the shared flipbook frames from
  `rasterizeFish`, uploaded once and batched. Larger fish keep their own canvas, redrawn with exact motion, clock and
  full detail, then uploaded; above 24 such fish they redraw on alternate frames.
- The continuous turn (`flip` between −1 and 1) is an affine squash, not a rotation, so sprites take the exact
  translate → scale(flip) → rotate matrix through `setFromMatrix`.
- Fallback: `?renderer=canvas`, a stored `fishtank-sim.renderer = canvas` preference, a failed WebGL start or a lost
  context keep the single Canvas 2D path, which draws the same fish. Each mount gets a fresh WebGL canvas: React's
  development double mount otherwise shared one context, and destroying the first application lost the second's.
- `pixi.js` moves from devDependencies to dependencies and loads as separate lazy chunks; the main bundle did not grow
  by Pixi's size.

## 7. Rarity for every species (user request)

`rarity.ts` places each visible trait value on six tiers — common, uncommon, rare, very rare, epic, legendary — by its
frequency in a fixed reference population: 800 model 2 offspring, each from its own unrelated founder pair. The
specimen tier is calibrated on the reference's own rarity scores (leave-one-out), so in random bred stock about 75% of
animals are common and about 0.5% legendary. The inspector panel lists non-common traits first (all on demand), the
overall tier, rarity points and how much rarer the animal is than bred stock, and, once the genotype is known,
**breeding potential**: hidden recessive carriers, module liability close to its threshold, latent module liability in
older genomes, and new alleles including leaps. Cards and shop listings show a tier chip from rare upward. Rarity is
display-only; buyer prices keep their own founder-frequency rule, so no save or price changed.

## 8. Verification

See [testing](../TESTING.md#r-201r-204-genesis-model-2-codex-and-pixi). In short: 377 tests in 54 files, strict
TypeScript and the production build pass; an in-app browser journey on an isolated port covered the migrated save
rebasing to model 2, fast breeding of model 2 young, the Codex crediting a discovery, the Allele Registry, clutch
ratios, the rarity panel for koi, axolotl and goldfish, card and shop chips, Pixi rendering with correct layering and
picking, a reload that passed replay validation, and the new Visual fixtures board.

## 9. Limits

- Balance values (module weights and thresholds, leap and regulatory shares, somatic rates, Codex tiers) are first
  tunings, not playtested.
- Goldfish carried no module genes in this report; their hoods and bubble eyes come from their own loci. A later
  follow-up (world v19, body-plan set 2, ADR-081) adds goldfish fin modules: a second dorsal fin and a second
  pectoral pair.
- Module mutations are not listed in `fish.mutations` (the mutation schema indexes the 72 locus arrays); the Codex and
  the inspector's body plan show their effect.
- Frame timing of the Pixi layer was not measured on named hardware in this session (the browser pane was hidden when
  timing was attempted); FS-704 still owns the device matrix.
- Shop founders are model 1 genomes: their module genes are latent and show only in Genesis-bred young.
