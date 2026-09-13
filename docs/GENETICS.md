# Genetics and development specification

**Baseline:** lab genome v1, development v1, renderer v1. **Scope:** synthetic game genetics. Gene names describe fictional controls, not identified koi genes. Source notes are preserved in [source/original-concept.txt](source/original-concept.txt).

## 1. Representation and actual combinatorics

A fish is diploid. Each locus has two copies; chromosomes retain phase, meaning which alleles lie together on one homolog. Lab v1 uses eight synthetic chromosomes of six ordered loci each, 48 total. Each allele is an integer ID A0–A5.

For six possible alleles, one locus has 6 × 7 / 2 = **21 unordered diploid genotypes**. Forty such loci have 21^40 ≈ **7.74 × 10^52** unphased multilocus combinations. The original note’s approximation is valid under these assumptions. It is not the number of rendered appearances, independently reachable lineages, or phases.

Lab v1 has 21^48 ≈ **2.93 × 10^63** unphased combinations. Ordered maternal/paternal encodings have 36^48 possibilities, but some encode the same phenotype and homolog relabelings. Do not present those encodings as independent visible fish. Linkage constrains how parental alleles recombine; initial population support and mutation affect accessibility.

Numbers this large must stay out of the hot path and save schema. “Millions of combinations” is easy mathematically. The hard requirement is **visible, heritable, playable variation**.

```ts
type Genome = {
  version: 1;
  maternal: number[]; // exactly 48 IDs; copy received from mother
  paternal: number[]; // exactly 48 IDs; copy received from father
};
```

These are JSON arrays in the lab for inspection. Production storage can use Uint8Array for the current six-allele scheme, with an explicitly versioned binary header. Do not reinterpret IDs as continuous values when adding non-additive alleles.

## 2. Randomness and identity

All genetics use the versioned Mulberry32-style PRNG in `src/core/random.ts`. Never use Math.random in genetics. The lab derives deterministic substream seeds from a world seed, monotonically increasing fish sequence, event type, and parent IDs.

Breeding consumes its own stream; sex assignment uses a separate derived seed. Drawing a portrait, viewing parents, and generating a future prediction must not consume birth randomness. Rendering reads the stored birth seed.

The short FNV-1a genome fingerprint is a **non-cryptographic checksum**, useful for display and test fixtures. It is not collision-proof identity, anti-cheat evidence, or a global identifier.

Local IDs are world-local (`FSH-000001`). Production IDs are UUIDs with a world ID, while the short sequence remains a display label. A globally trusted genome digest will require canonical byte serialization and a cryptographic hash; server provenance establishes authority.

## 3. Founder distribution

For each transmitted copy at each locus, lab v1 uses weights:

| Allele | A0 | A1 | A2 | A3 | A4 | A5 |
|---|---:|---:|---:|---:|---:|---:|
| Weight | 0.10 | 0.22 | 0.32 | 0.24 | 0.10 | 0.02 |

The same distribution across all loci is a prototype simplification. It creates central ancestral morphology and rare extremes. Locus-specific founder populations are needed before balance tuning. A5 is not intrinsically the “best” allele; it happens to encode an extreme numeric value at additive loci and a specific effect at switch loci.

For an independently sampled recessive A5/A5 switch, the founder probability is 0.02² = 0.0004 (0.04%). A small population cannot reliably estimate that rate. Recessive carrier probability in this initializer is 2 × 0.02 × 0.98 = 3.92%.

### Registry contract for the next stage

```ts
interface LocusDefinition {
  id: string;
  chromosomeId: string;
  positionCm: number; // synthetic map distance; not physical fish chromosome evidence
  expression: 'additive' | 'dominant' | 'recessive' | 'codominant' | 'regulatory';
  alleles: {
    id: string;
    effect: number | Record<string, number>;
    founderWeight: number;
    mutationTargets: { id: string; weight: number }[];
  }[];
  expressionVersion: number;
}
```

Never change locus order, effect semantics, or allele meaning in place on an existing save version.

## 4. Meiosis and linked inheritance

For each parent and chromosome:

1. Choose homolog 0 or 1 with probability 0.5.
2. Emit the first locus from that homolog.
3. At each later boundary, switch homolog with probability 0.12.
4. Emit that locus from the current homolog.
5. Apply mutation to the transmitted allele, after copy selection.
6. Start each new chromosome with an independent 0.5 homolog draw.

The maternal gamete becomes the child’s maternal array; paternal gamete becomes its paternal array. Preserve this phase for later crosses.

The current 0.12 value is a **per-boundary recombination switch probability**, not a 12% probability that the whole chromosome recombines, not a chromosome-length model, and not an actual koi recombination rate. There are five boundaries per lab chromosome.

For the production map, define distances and derive recombination fractions with a documented mapping function or simulate crossover positions explicitly. First decide whether interference is needed; it is not required for the core game. One implementation must not silently alternate between independent assortment and linked meiosis.

### Mendelian example

A5/A0 × A5/A0 at the metallic switch, mutation disabled:

| Offspring genotype, phase ignored | Expected probability | Strong metallic switch |
|---|---:|---|
| A0/A0 | 25% | Off |
| A0/A5 or A5/A0 | 50% | Off; carrier |
| A5/A5 | 25% | On |

Base reflectivity still contributes in non-A5/A5 fish. “Not strongly metallic” does not mean completely matte.

## 5. Mutation

**Implemented:** per transmitted copy probability μ = 0.003. With 96 transmitted copies, the probability of at least one mutation is 1 − (1 − μ)^96 ≈ **25.06%**. Expected mutations per child = 96μ = 0.288.

This deliberately high lab rate produces small numerical changes for experimentation. It is not a natural mutation estimate and should be reduced/rebalanced for long-term play. Do not label it “0.3% of births.”

Each mutation moves to an adjacent allele ID. At A0 it moves to A1; at A5 it moves to A4; other alleles move ±1 with equal probability. This prevents a recorded mutation that leaves the allele unchanged. Parent genomes remain immutable.

Mutation events currently store locus index, received copy, prior allele, and new allele. Production needs mutation-event UUID, first carrier ID, mutation class, version, and inherited origin tracing. A descendant inherits the mutation provenance even when it does not have a new de novo event.

### Planned mutation classes

| Class | Scope | Proposed initial rate basis | Implementation gate |
|---|---|---|---|
| Small effect | Adjacent additive allele | Tune per transmitted copy | Already implemented at lab rate |
| Regulatory | Pigment/fin/head expression gain | Separate weighted transition table | Stable phenotype descriptors |
| Pattern | Frequency/warp/edge or developmental pattern seed structure | Per relevant locus copy | Measured parent-child resemblance |
| Structural | Bounded fin/tail/barbel topology variant | Start around 1e-4 per tracked birth for the entire class | Anatomy validation and visual fixtures |
| Major developmental | Compatible multi-structure template | Later, lower event rate | Long-term population experiments |
| Meta-mutability | Region-specific rate modifier with clamps | Deferred | Economy and mutation discovery pacing stable |

Rates are not additive rarity promises. A 1e-4 structural event rate produces a probability of about 63.2% of at least one event across 10,000 tracked births. At 200 births the chance is only about 2%. Therefore a “very rare” structural system can be effectively absent for ordinary players. Tune against playtime and tracked births; use an optional research sandbox multiplier, never an invisible pity reroll that changes previously committed offspring.

## 6. Lab locus catalog and expression coverage

For an additive locus, n = (maternal allele ID + paternal allele ID) / 10. Below, “render” means visible today; “motion” means affects the current movement demo; “potential” means calculated but not integrated into age/care. Regulatory genes alter other outputs. The registry order is the table order.

| Chr | Locus | Expression/output | Used today |
|---|---|---|---|
| 1 | body_length | Normalized longitudinal scale 0.7–1.6; contributes to adult size | Render, potential |
| 1 | body_depth | Depth/length ratio 0.12–0.60; drag contribution | Render, motion |
| 1 | body_taper | Peduncle factor 0.08–0.28 | Render |
| 1 | spine_curve | Back curvature offset −0.10–0.10 | Render |
| 1 | head_length | Head proportion with head_gain | Render |
| 1 | snout_length | Snout extrusion 0.015–0.135 length units | Render |
| 2 | eye_size | Radius 0.015–0.060 length units | Render |
| 2 | eye_position | Vertical eye-placement factor 0.10–0.55 | Render |
| 2 | iris_hue | 35–245 hue degrees | Render |
| 2 | pupil_size | Pupil/iris radius 0.35–0.85 | Render |
| 2 | mouth_size | Mouth line and lip shape 0.015–0.090 | Render |
| 2 | barbel_length | Length 0.015–0.195; fixed two barbels | Render |
| 3 | tail_length | 0.14–0.76 multiplied by fin gain | Render, drag |
| 3 | tail_spread | 0.12–0.54 body-length units | Render |
| 3 | tail_fork | Indentation 0–0.75 | Render |
| 3 | dorsal_height | 0.035–0.275 multiplied by fin gain | Render |
| 3 | pectoral_length | 0.06–0.32 multiplied by fin gain | Render |
| 3 | fin_pigment | Threshold between neutral and pigmented fins | Render |
| 4 | red | Warm-layer opacity, multiplied by pigment gain | Render |
| 4 | yellow | Warm-layer hue and base tint | Render |
| 4 | black | Dark-layer opacity; suppressed by switch | Render |
| 4 | white | Base lightness | Render |
| 4 | reflectivity | Baseline metallic response up to 0.45 | Render |
| 4 | translucency | Bounded pigment transparency proxy 0–0.35 | Render |
| 5 | pattern_frequency | 3–16 main pigment patches | Render |
| 5 | pattern_scale | Patch radius factor 0.05–0.20 | Render |
| 5 | pattern_warp | Patch aspect variation | Render |
| 5 | pattern_symmetry | Compresses vertical placement spread; not true bilateral matching yet | Render |
| 5 | pattern_edge | Hard versus softened patch edges | Render |
| 5 | speckle | 0–55 small flecks | Render |
| 6 | size_1 | 45% contribution to size potential | Potential |
| 6 | growth_rate | 0.5–1.5 growth multiplier | Potential only |
| 6 | longevity | 8–32 game-year potential | Potential only |
| 6 | metabolism | 0.6–1.6 demand multiplier | Potential only |
| 6 | oxygen_demand | Size- and tail-dependent oxygen demand proxy | Potential only |
| 6 | fertility | 0.3–0.9 potential | Potential only; lab births fixed at 20 |
| 7 | thrust | Base normalized speed 0.035–0.090 before drag | Motion |
| 7 | turning | Steering multiplier 0.7–2.1 | Motion |
| 7 | activity | Speed and tail-beat modulation | Motion, render |
| 7 | sociability | Nearby cohesion weight | Motion, inspector |
| 7 | boldness | Food approach strength | Motion, inspector |
| 7 | curiosity | Future investigate-state tendency | Inspector only |
| 8 | size_2 | 35% contribution to size potential | Potential |
| 8 | pigment_gain | Pigment modifier 0.65–1.35 | Render |
| 8 | fin_gain | Fin modifier 0.65–1.35 | Render, drag |
| 8 | head_gain | Head proportion modifier | Render |
| 8 | melanin_switch | A5/A5 suppresses dark pigment | Render, recessive |
| 8 | metallic_switch | A5/A5 gives metallic response 1 | Render, recessive |

All loci are inherited; some physiological outputs are intentionally not active simulation systems yet. The UI must not imply actual fertility success or current lifespan is being simulated.

### Current key formulas

```text
sizePotentialCm = 22 + 76 × (0.45 size_1 + 0.35 size_2 + 0.20 body_length)
finGain         = 0.65 + 0.70 fin_gain
tailLength      = (0.14 + 0.62 tail_length) × finGain
speed           = (0.035 + 0.055 thrust) / (1 + 0.70 tailLength + 0.35 bodyDepth)
oxygenProxy     = (0.60 + oxygen_demand) × (sizePotentialCm / 50)^2 × (1 + 0.30 tailLength)
```

These inputs refer to normalized additive n values. Geometry ratios, centimeters, normalized tank widths/second, and unitless proxies must be distinguished in future TypeScript types.

## 7. Planned genome v2: 24 additional loci

Do not add these as unused rows to genome v1. Add a separate schema/version only once expression and tests exist.

| Chr | New locus | Purpose and guardrail |
|---|---|---|
| 9 | tail_topology | Enum: standard, paired fan, crown-four; no arbitrary mesh count |
| 9 | tail_lobe_balance | Relative lobe scaling with bounded minimum |
| 9 | dorsal_presence | Normal, reduced, suppressed |
| 9 | pectoral_topology | Standard or supported doubled arrangement |
| 9 | barbel_count | 0, 2, 4, 6 only |
| 9 | vertebral_extension | Longitudinal control-point distribution, bounded |
| 10 | scale_size | Repeating scale geometry/shader frequency |
| 10 | scale_coverage | Regional scale suppression mask |
| 10 | eye_protrusion | Position relative to head surface within anatomy envelope |
| 10 | jaw_orientation | Mouth axis, preserving visible attachment |
| 10 | cheek_depth | Local head silhouette |
| 10 | fin_ray_density | Fin ray count within render budget |
| 11 | aggression | Territorial utility, not automatic damage |
| 11 | depth_preference | Target normalized vertical region |
| 11 | food_drive | Appetite and approach utility |
| 11 | human_affinity | Learned approach baseline |
| 11 | mate_selectivity | Strength of bounded compatibility penalties |
| 11 | maturity_rate | Life-stage timing |
| 12 | preference_red | Signed attraction to red coverage |
| 12 | preference_size | Signed attraction to relative size |
| 12 | preference_tail | Signed attraction to tail display |
| 12 | stress_recovery | Rate of environmental recovery |
| 12 | resilience | Specific condition tolerance, not universal immunity |
| 12 | recessive_load | First explicit modeled harmful recessive effect |

This yields 72 loci within the original requested scale. Future additions need measured player value and a version migration rather than an arbitrary goal of 100 genes.

### Escaping the koi silhouette

Stage 1: select length, depth, head, snout, eyes, and fins within v1 bounds. Stage 2: inherit supported topology changes in v2. Stage 3: use selected compatible parameters to extend a topology’s shape over generations.

Examples to build as render fixtures: elongated needle body; deep disk body; large domed head with small eyes; broad fan-tail; small body with long snout; four-lobed crown tail. A fixture must be reachable through permitted allele states, not a handcrafted renderer exception keyed to a fish name.

## 8. Development and phenotype contract

The lab shows adult genetic potential. Planned development integrates:

```text
ageFactor = 1 − exp(−growthRate × ageDays / growthScaleDays)
condition = bounded time-integral of nutrition, oxygen, stress and health
currentLength = juvenileMinimum + ageFactor × (geneticAdultLength − juvenileMinimum) × condition
pigmentMaturity = smoothstep(revealStartDays, revealEndDays, ageDays)
visiblePigment = geneticPigment × pigmentMaturity × boundedDietResponse
```

Treat this as a proposed approximation to validate, not a scientific fish growth law. Chronic development deficits need history, not merely today’s water quality. Returning to healthy conditions should improve future growth smoothly, not instantly shrink or expand an adult.

Phenotype owns anatomy, material/pigment descriptors, physiological potential, and behavior weights. Renderer only consumes phenotype. Persist development state and model versions. The same world snapshot, genome, seed, and version should reproduce the same parameters.

## 9. Procedural pattern and morphology plan

Current Canvas renderer constructs a Bézier body, fins and rays, eye/pupil, mouth/barbels, and seeded pigment patches. Birth-seed placement is independent between siblings, while patch count, scale, edge, hue and distribution tendencies are inherited. This can weaken family resemblance and is an explicit research risk.

Next renderer:

1. Normalize body coordinates as longitudinal u and cross-section v.
2. Build a bounded spline centerline and per-section radii from phenotype.
3. Attach fin templates to stable anatomical anchors.
4. Generate pigment fields in body coordinates, so markings stay attached while swimming.
5. Compose warm, dark, pale and reflective layers using inherited regulatory masks.
6. Introduce limited birth-seed microvariation; preserve low-frequency inherited pattern structure.
7. Cache body-space material/mesh descriptors; animate centerline/fin deformation separately.

Do not start with reaction-diffusion on every frame. Compare cached noise/Voronoi masks first; add more expensive synthesis only if it materially improves readable inheritance. Real iridescence is an optical effect; the lab’s metallic gradient is an artistic proxy.

Anatomy validators must ensure positive body dimensions, eye attachment, continuous mouth/head, fin roots inside body, bounded lobe counts, no NaNs, reasonable bounding boxes, and valid winding/indices. Reject or constrain unsupported expressions with logged diagnostics, never silently delete a fish.

## 10. Rarity with honest scope

### Allele rarity

Count allele copies, not fish. For locus l and allele a: p(l,a) = count(a) / (2N). Show N, population scope, sample timestamp, and estimation method. For sparse measurements, use a declared prior or a confidence interval; do not replace an unseen count with proof of impossibility.

A genotype surprise score can sum capped negative log frequencies as a design heuristic. Independence is false under linkage and selection; this score is not a calibrated joint probability. Preserve a tooltip explaining this and never derive market price directly from an unbounded sum.

### Visible unusualness

Compute a descriptor vector (length/depth/head/eye/fin ratios, pigment coverage, pattern frequency, texture metrics, topology category). Normalize against a versioned reference cohort. Estimate local density or nearest-neighbor distance within compatible topology groups. Compare against held-out samples and show the reference size.

Do not use genome hash uniqueness as phenotype rarity. Do not include hidden allele differences in a metric labeled visible.

### Lineage scarcity

Track mutation-origin IDs and living descendant carrier counts within the known population. Historical carrier counts and living counts are separate. A recreated identical allele through a different mutation is not necessarily the same historical origin.

### Valuation

Use rarity as a bounded input to an NPC/customer-specific desirability model. A tail can be rare and unsuitable for that buyer. Local rarity measures must not leak into online pricing as trusted claims.

## 11. Pedigree and diversity

The lab constructs the numerator relationship matrix A in ancestor-before-descendant order:

```text
A[i,j] = 0.5 × (A[mother(i),j] + A[father(i),j]) for j < i
A[j,i] = A[i,j]
A[i,i] = 1 + 0.5 × A[mother(i),father(i)]
kinship(i,j) = A[i,j] / 2
F(child) = kinship(mother,father)
```

Unknown founders are assumed unrelated and non-inbred. Parents always have lower generation than a child; saves must reject cycles or inconsistent generations. Sold fish remain in the matrix.

Heterozygosity = heterozygous loci / assayed loci. It is not “genetic diversity of the species” and it does not equal 1 − F. Alleles identical in state need not be identical by descent.

The tabular matrix is O(N²) space/time and capped at 1,000 records in the lab. Production needs incremental/coancestry caching, ancestor subgraph queries, and bounded worker computations. Never build a million-by-million matrix.

## 12. Validation gates

- Exact repeatability from seed, parents, parameters and version.
- No mutation: every transmitted allele must occur at that parental locus.
- Fixed seeded sample: A5/A0 × A5/A0 approaches 25/50/25 within a declared statistical tolerance.
- Parent genome input arrays remain unchanged.
- Mutation logs agree with inherited genotype; boundary mutations really change an allele.
- Chromosome phase is linked; verify the recombination probability with a synthetic marker chromosome.
- All output numbers finite over random and adversarial extreme genomes.
- Long-tail drag lowers speed with other genes held constant.
- Full siblings, half siblings, cousins, parent-offspring and outcross pedigree fixtures.
- Ten-generation artificial selection moves a declared phenotype descriptor.
- Renderer fixtures at corners and incompatible anatomy boundaries.
- Save migration reproduces archived developmental appearance and parent IDs.

Automated checks in the repository cover a subset of these; see [TESTING.md](TESTING.md). Visual resemblance and population balance need human observation and experiments, not just unit tests.
