# Revamp report: from research lab to a breeding game where you play god

**Date:** 16 October 2026 · **Status:** proposal; recommendations 1–4 are now implemented as FS-129 (see [implementation status](IMPLEMENTATION_STATUS.md)) · **Authors:** a joint review by three roles: game designer, senior web developer and marketer.

This report reviews the current game loop and the koi and axolotl genomes, then proposes how to turn Fishtank Sim into a breeding and evolution game. The brief: put the simulated breeding first, give it far more variation, make it feel biological, and let the player play god.

Everything under "What exists" was checked against the source on `main` (`3cfc4ea`). Everything under "Proposals" is new design. None of it is built.

---

## 0. The short version

**The foundation is unusually strong, but the game sits on top of the genetics and not inside them.** You have deterministic phased diploid inheritance, linkage, mutation origins traced by descent, pedigree F, bloodlines, procedural anatomy and journal replay. Most commercial breeding games have none of this. Today, though, the genome works like a **set of 66 sliders that average their two copies**. Inbreeding costs nothing. Nothing dies. Every trait can be bred toward with no trade-off. And there is a ceiling, because each locus has exactly six alleles, so novelty runs out.

The three of us agree on one thesis:

> **Make the genetics have consequences, make novelty unbounded, and make discovery the core loop.**
> The player should feel like a scientist-deity: they *discover* how life works in this world, *exploit* it to shape creatures, and *create* things that never existed before. Every creature is unique, and every lineage is a story they wrote.

Top 10 recommendations, in priority order:

| # | Recommendation | Owner | Why |
|---|---|---|---|
| 1 | **Genetic Architecture v4:** dominance, epistasis, pleiotropy, trade-offs and developmental noise | Design + Dev | Turns slider-averaging into real breeding puzzles |
| 2 | **Genetic load and inbreeding depression** (hidden deleterious recessives, purging, heterosis) | Design | The missing cost that makes outcrossing a strategy; the GDD already promises it |
| 3 | **Open-ended alleles:** mutations create *new* alleles with their own effect vectors, named after the fish where they arose | Design + Dev | Removes the six-allele ceiling; a "one of a kind" claim becomes literally true |
| 4 | **Genome Atlas (discovery mode):** loci start unmapped; the player maps them through test crosses, linkage and sequencing | Design | Science as gameplay; the "god's notebook" fantasy |
| 5 | **Hatch Reveal ceremony + generation-paced time** | Design + Dev | The dopamine moment the loop lacks; cuts 25 clicks per generation to 1 |
| 6 | **God Tools tech tree:** mutagen lamp, gene editing, cloning, cryobank, hybrid chamber, each with honest costs and a pedigree mark | Design | The literal "play god" fantasy, made progressive |
| 7 | **Speciation:** isolated lines diverge, become incompatible and are named as new species by the player | Design | The ultimate creation payoff and a long-term goal |
| 8 | **Data-driven species engine + structural-sharing command layer** | Dev | Unblocks new species and fixes the 85 ms/command scaling defect |
| 9 | **Weekly Genesis Challenge:** a shared seed with replay-verified leaderboards | Marketing + Dev | Uses the deterministic journal you already have; cheap virality without a server-owned economy |
| 10 | **Axolotl-first positioning** with share cards and evolution time-lapse export | Marketing | Axolotls are a proven mass-appeal mascot; shareable output drives organic reach |

---

## 1. What exists today (verified)

### 1.1 The main game loop

```text
            ┌──────────────── explicit calendar: Next day / Week / Month ───────────────┐
            ▼                                                                           │
advanceRuntime → advanceWorld (per absolute game-day boundary)                          │
   1. integrateTanks       water O₂/ammonia/food in 25-tick steps (1200 ticks/day)      │
   2. developResidents     condition = moving average of environment; logistic growth   │
   3. advanceClutches      courtship 2–4 days → eggs (reserved nursery) → hatch at 3 d  │
   4. recoverDemand, refreshShop, refreshAxolotlShop, advanceRelief, circuit.day        │
            │                                                                           │
            ▼                                                                           │
Player commands (Zod-validated, atomic, journaled): pair · breed(fast) · move · sell ·  │
buy-listing · set-care · feed · decorate · register-bloodline · enter-competition … ────┘

Separate presentation clock: the motion worker (behavior v3 utility AI) runs at real time
and never changes persistent state.
```

Sources: [habitat.ts](../src/core/habitat.ts), [runtime.ts](../src/core/runtime.ts), [breeding.ts](../src/core/breeding.ts), [development.ts](../src/core/development.ts), [behavior.ts](../src/simulation/behavior.ts), [App.tsx](../src/ui/App.tsx).

**Pacing math.** Courtship takes 2–4 days, incubation 3 days and maturity about 22 days after hatching. One generation is about **28–30 game days, so about 30 "Next day" clicks** (or one "Month" click that skips all the drama). FS-605 measured a median of **95 births to a first structural mutation**, and a new tail line established between days 93 and 391.

### 1.2 Koi genome

- **66 loci on 11 synthetic chromosomes**, six loci each, with six alleles per locus ([catalog.ts](../src/core/catalog.ts)).
  - Genome v1: 48 "core" loci (body, face, fins, pigments, pattern, life history, behavior, regulation).
  - Genome v2: 12 Color and Ornament loci.
  - Genome v3: 6 Structure loci (tail topology, dorsal form, barbels…).
- **Expression ([genetics.ts](../src/core/genetics.ts) `express`):** each core trait is `g = (maternal + paternal) / 10`, a **pure additive dosage**. There are only two recessive switches (`melanin_switch`, `metallic_switch`). Appearance loci add classic-dominant, rainbow-dominant, recessive and overlay rules ([appearance.ts](../src/core/appearance.ts)). Structure loci add structural recessives and a barbel series.
- **Meiosis:** one homolog choice per chromosome, then a 12% switch at each adjacent boundary. Per-copy mutation is 0.003 (0.001 for the structural class). **Mutations only step to an adjacent allele**, so the alphabet is fixed at six.
- **Pleiotropy:** a little. Tail length raises oxygen demand and lowers speed, and size feeds oxygen.

### 1.3 Axolotl genome

- **66 independent loci on 11 chromosomes** with centimorgan positions. Crossover probability comes from map distance (capped at 0.45), and the mutation rate is 0.0015 times per-locus multipliers ([axolotlCatalog.ts](../src/core/axolotlCatalog.ts), [axolotlGenetics.ts](../src/core/axolotlGenetics.ts)).
- Allele effects are graded −1…1 (quantitative), named categorical hues and pattern modes, and three recessive pigment switches (leucistic-like, albino-like, melanoid-like). A switch expresses only when both copies are "severe" (allele ≥ 4).
- **Morph priority** is the only real epistasis: albino > leucistic > melanoid > threshold-derived axanthic, hypomelanistic or xanthic. This is the most biologically flavored part of the codebase.
- **Recorded but not simulated:** regeneration, maturity timing and feeding drive.

### 1.4 What happens around the genome

| System | State | Note |
|---|---|---|
| Development | Logistic growth toward genetic adult length; condition limits growth | **No phenotypic plasticity:** environment never changes color, shape or fins |
| Health / death | Condition 0–1 | **Nothing dies.** Longevity is 8–32 game years (2,900–11,700 days), so in practice "elderly" is never reached |
| Inbreeding | Pedigree F computed and shown | **No consequence.** The GDD's "modeled recessive burden" is not built |
| Selection pressure | None from the environment | Every phenotype is equally viable; only the player selects |
| Behavior genes | Drive swimming in the worker | No persistent effect: a bold fish never wins more food or shows better |
| Economy | 5 NPC buyers, capped budgets (◈20–260) | No recurring sink after build-out (FS-505 risk); a rare mutant sells like a nice fish |
| Competitions | Fixed formula: symmetry, metallic, spread, contrast, density, condition | The `theme` field is generated but **judging ignores it**, so one phenotype is always optimal |
| Prediction | Exact single-locus odds + 256-sample ranges; goals rank up to 4 traits | Good expert tooling |
| Lineage | Six-generation family graph, kinship cache, mutation origins, bloodlines | **The standout feature** |

---

## 2. Game designer's review

### 2.1 Pros (keep and amplify)

1. **Identity and lineage permanence.** Immutable IDs, parent links, origins traced by descent and bloodlines that keep separate ancestry and similarity scores. This is the soul of a "play god" game: every creature has a provable past.
2. **Honest, inspectable genetics.** Phased chromosomes, carrier chips, locus notes, exact odds. Expert players (the Pokémon IV-breeding, ARK mutation-stacking and Chicory-color crowd) will love this depth.
3. **Determinism.** Seeded streams mean every cross replays. That is a design superpower: shareable seeds, verifiable challenges, "what if" rewinds.
4. **Visible inheritance has been proven.** FS-111: 54 of 60 observer trials beat chance at telling relatives apart. Family resemblance is real.
5. **The axolotl morph priority** shows the team can do real epistasis. It is the template for the whole revamp.
6. **Structural mutations** (paired and crown tails, absent dorsal, barbels) render validly. The anatomy pipeline is ready for more.

### 2.2 Cons (the design problems)

1. **Additive averaging makes breeding a solved problem.** With `g = (m + p) / 10`, the child's expected trait is exactly the parents' midpoint. Truncation selection on any trait converges predictably. There are no hidden surprises, no "two plain parents throw a spectacular child" moments outside the few recessive loci. *Breeding feels like moving sliders slowly.*
2. **No costs, so no strategy.** Inbreeding is free, extremes are free, and every trait is equally viable. The optimal play is "pick the best two and inbreed forever". The pedigree-F display is information with no decision attached.
3. **Novelty has a ceiling.** Six alleles per locus and adjacent-step mutation mean the possibility space is large but **closed**. A veteran will eventually have seen everything. "Singular" rarity bands can never truly be earned.
4. **Time is a chore, not a drama.** About 30 clicks per generation, while the payoff (hatching) is a toast notification. The most important moment in a breeding game, *meeting the children*, has no ceremony.
5. **No pull.** No missions, no clients with specific orders, no tech progression, no reason to go after *this* mutation now. Competitions exist, but a fixed formula means one fish type always wins.
6. **The two species are two islands.** They share a tank but no genetic ideas. There is no hybridization and no speciation, so the "create life" fantasy stops at variants.
7. **Behavior and life-history genes are cosmetic.** Boldness, regeneration, maturity and fertility (beyond courtship speed) never decide anything the player cares about.
8. **Rendered variation is axis-limited.** The variation is strong on color and pattern, weaker on body plan. Topology is a handful of enumerated templates.

### 2.3 The new design: "Genesis" pillars

1. **Discover the rules.** The world's genetics are a mystery the player solves.
2. **Bend the rules.** Tools let the player push mutation, recombination and selection, at a price.
3. **Create the unprecedented.** Unbounded alleles, body-plan modules and speciation mean the player makes things nobody else has.
4. **Live with consequences.** Load, trade-offs, ecology and (optional) mortality make every godlike act a decision.
5. **Every life is a story.** Keep the lineage permanence and make it the narrative engine.

### 2.4 Feature proposals

#### A. Genetic Architecture v4: biology that bites

The new expression model replaces averaging with layers. Each layer creates a different kind of breeding puzzle.

| Layer | Mechanic | Player experience | Real-biology anchor |
|---|---|---|---|
| **Dominance** | Each allele has a dominance coefficient *h* (0 recessive … 0.5 additive … 1 dominant, plus rare >1 overdominance) | Hidden carriers everywhere; "two plain parents → spectacular kid" | Mendel, overdominance |
| **Epistasis modules** | Master switches gate whole trait modules (e.g. a *Pigment cascade* gate: no crest cells, so all color loci are silent) | Hidden potential: a white fish may carry a rainbow genotype; test crosses reveal it | MITF/kit-like cascades, albinism masking |
| **Pleiotropy and trade-offs** | Sparse effect matrix: long fins → slower, more O₂; bright color → more visible to predators (challenge mode); big size → slower maturity | No free lunch; specialist lines vs all-rounders | Life-history trade-offs |
| **Polygenic micro-loci** | A "background genome" of ~200 tiny-effect loci (cheap packed bits) per species | Continuous variation, real response to selection over generations | Quantitative genetics |
| **Developmental noise** | A per-fish seeded jitter on development (pattern placement, asymmetry) | Clones and identical genotypes still differ slightly; every fish is unique | Developmental stochasticity |
| **Phenotypic plasticity** | Environment shifts expression within genetic bounds: temperature → color intensity, carotenoid food → red, crowding → smaller adult, dark substrate → darker pigment | Care becomes creative, not just maintenance | Reaction norms |
| **Threshold traits** | A liability score crosses a threshold to switch structure (extra lobe, extra digit) | "Almost there" lines; selection pushes a population over the edge | Threshold models of polydactyly |
| **Sex linkage** | ZW (axolotl, which is accurate) and XY (koi-like) sex chromosomes carrying a few traits | Sex-limited colors, crisscross inheritance puzzles | Real for axolotls (ZW) |

**Compatibility.** This is genome v4 / development v6. Existing fish keep their recorded versions and expression, following the established rule that stored genomes are never rewritten. New founders and offspring of v4 parents use the new architecture. A v3 × v4 cross reads missing loci at baseline, exactly as v1 → v2 → v3 works today.

#### B. Genetic load: why outcrossing matters

- Every founder carries 0–4 **hidden deleterious recessives** from a per-species catalog. Each is lethal (the egg fails to hatch), sub-lethal (lower condition ceiling), a fertility hit (smaller clutches) or a malformation (bent spine, fused fins, missing gill). A drawn malformation is the honest visual consequence.
- **Inbreeding depression** emerges naturally: higher F → more homozygous load → visible costs. The pedigree F display finally matters.
- **Purging:** a disciplined breeder who culls (rehomes) affected fish can clean a line over generations. This is a real, rewarding expert strategy.
- **Heterosis:** outcrossing two inbred lines gives a vigor bonus (condition, growth, fertility). That gives founder expeditions a purpose.
- **Diagnostics are a God Tool:** "carrier screening" reveals load at a cost.

*Design guard:* load must never be invisible and unfair. The UI says "egg failed: homozygous for *lethal L-07* inherited from Haru (FSH-000001) on both sides." Lineage traces this already.

#### C. Open-ended alleles: infinite novelty

- A mutation **creates a new allele record**: `{ id: "FSH-004211·tail_length·m1", parentAllele, effect: parentEffect + seeded δ, dominance h' }`. Effects are bounded vectors over the trait space, with clamps per developmental parameter so anatomy stays valid (keep the FS-602 sweep discipline).
- Most new alleles are neutral or slightly bad (realistic and good for tension). A few are leaps. Structural-class mutations can create **new module copies** (see D).
- New alleles are **named after the first carrier**, exactly like `origins` today, and enter the save's **Allele Registry**. "Lineage scarcity" becomes concrete: *this allele exists only in your world, and only in 3 living fish.*
- Storage: a per-world allele table (allele IDs on the genome arrays become indices into that table). Founder alleles stay as the fixed 0–5 catalog.

#### D. Body-plan modules: new body shapes, not just new colors

Generalize Structure into a **module graph**: body segments, fin slots, limb pairs, gill rami, eye pairs, crests and barbels. Rare mutations may **duplicate, delete or transform** a module (homeotic-style):

- Koi: a second dorsal fin, ventral sail, split caudal (exists), feather pectorals, bubble-eye pouches, lionhead wen (classic fancy-goldfish phenotypes; huge visual payoff).
- Axolotl: polydactyly, an extra gill ramus, crested back, a **regeneration-error branch** (a regenerated limb grows doubled, which really happens), dwarfism, long-limbed "walker" lines.
- Each module has a renderer recipe and bounds, validated by the existing anatomy sweep approach.

#### E. Genome Atlas: discovery as the core loop

- In **Discovery mode** (the new default), locus names and functions start **unknown**: "Chromosome 3, locus 4: ???". Chromosome cards show only what has been learned.
- The player learns by **doing real genetics**:
  - **Test crosses:** cross a mystery dominant phenotype to a known recessive to reveal genotype.
  - **Segregation ratios:** a clutch shows 3:1 → the Atlas proposes "single recessive locus?" and the player confirms.
  - **Linkage mapping:** traits that co-inherit reveal map distance. A mini-game places loci on the chromosome bar with recombination fractions.
  - **Sequencing** (a God Tool): spend credits or research points to reveal a fish's genotype directly.
- **Scientist mode** (today's full transparency) stays as an accessibility and expert option.
- Completing the Atlas unlocks the **Codex**: a gallery of named phenotypes the player has produced. "Inkblot Crown", "Ghost Walker" and similar names are auto-recognized by descriptor clustering, and the first discovery is credited to a fish.

#### F. Hatch Reveal and generation-paced time

- **Hatch Reveal:** eggs appear as a clutch tray. Each egg "cracks" in sequence, with a card flip showing portrait, sex, notable traits, **new mutation sparkles** and "carrier of…" badges (only those already mapped in the Atlas). Keep / Nursery / Rehome triage happens right there. This is the pack-opening moment, fully deterministic and earned.
- **Time controls:** keep Day/Week/Month, and add **"Advance to next event"** (next hatch, maturity or courtship finish) and **"Run generations…"** (see G). Swimming stays a separate presentation clock.

#### G. Breeding Programs: automation for scale

The fantasy of "many variations" needs thousands of births without thousands of clicks.

- **Program editor:** "In tank Lagoon, keep the top 10 by *tail length* and *violet accent*; pair best × best avoiding F > 0.125; outcross with a shop founder every 4 generations; rehome the rest."
- **Epoch runner:** runs N generations in the worker (headless; the core is already pure), streaming a **live evolution chart**: trait means, variance, F, allele frequencies, new alleles discovered. Stop on condition ("first crown tail", "F > 0.3").
- Reuses the scenario harness pattern (`unusualLineScenario`, `soakScenario`) and goes only through real commands, so programs are honest, replayable and journaled.
- Gate: Programs unlock after the player has hand-bred a few generations, so the core loop is learned first.

#### H. God Tools: a lab tech tree with ethics

| Tool | Effect | Cost and consequence |
|---|---|---|
| Carrier screening | Reveals hidden recessives/load of one fish | Credits; time |
| Sequencer | Reveals full genotype | Credits, research points |
| Mutagen lamp | ×5–×50 mutation rate for one clutch | More load and malformations; offspring marked "induced" |
| Cryobank | Freeze gametes; breed with ancestors who are gone (sold, rehomed, dead) | Storage slots; the defining "resurrect a lost line" move |
| Clone | Copy a genome (new ID, new birth seed so noise differs) | Expensive; pedigree shows "clone of"; competitions may restrict |
| Gene editor | Set one allele at one locus | Very expensive, limited charges; permanent "edited" mark; banned from "Heritage" shows |
| Hybrid chamber | Attempts crosses between diverged lines or species | Low viability, sterility (realistic), and chance of novel hybrids |
| Environment chamber | Extreme temperature or chemistry to trigger plasticity | Condition stress |
| **Metamorphosis trigger (axolotl)** | Induce metamorphosis (real axolotl biology: thyroid-triggered): gills absorb, it becomes terrestrial-form | Irreversible; shortens life; spectacular visual transformation |

**Reputation axes:** *Heritage* (pure, unedited, natural lines) vs *Innovation* (engineered firsts). Competitions, clients and endings respond differently. Playing god is allowed and meaningful, never punished arbitrarily.

#### I. Speciation: the ultimate creation

- Each tank population accumulates a **divergence score** from its unique alleles and generations of isolation.
- Past thresholds, crosses between diverged lines show **hybrid breakdown** (Dobzhansky–Muller incompatibilities: reduced fertility, then sterile F1s).
- Once reproductively isolated, the player **names a new species**, with a generated binomial they can edit. It gets its own Codex page and a phylogeny entry.
- **Tree of Life view:** a phylogeny of all the player's lines and species, with portraits at the nodes. This is the trophy screen of the whole game.

#### J. Ecology and challenge modes (optional mortality)

- **Sanctuary mode** (today's default): no death, protected absence.
- **Ecosystem mode:** death by old age (rescale longevity to playable spans, e.g. 1–3 game years), load, and an optional predator or competitor species. Natural selection runs **alongside** artificial selection: long-finned fish lose food races, pale fish are taken by the heron.
- **Pond/biome tanks:** cold pond, blackwater, karst spring, each pushing plasticity and selection differently. Divergence across biomes leads naturally to speciation.
- **Disease with genetic resistance:** an immune-diversity locus (MHC-like). Outbreaks spare heterozygous populations, which is a second, emergent argument for diversity.

#### K. Goals and pull

- **Commissions:** NPC clients with specific orders ("a red-eyed crown tail under 40 cm by Spring Year 2") with rising reward. They replace flat buyers as the main income.
- **Rotating breed standards:** the competition `theme` finally drives judging ("This season: violet accents and paired fans"). This breaks the single optimum.
- **Two show divisions:** *Best in Standard* (closest to a published standard) and *Most Novel* (descriptor-space distance from all previous winners), which rewards both refinement and invention.
- **Expeditions:** buy expedition permits to biomes with different founder allele frequencies. Wild founders bring new variation and new load.
- **Lab progression:** research points from discoveries (Atlas entries, new alleles, species) unlock God Tools, tanks and biomes.

#### L. Small, high-value fixes to do first

1. Make the competition `theme` affect scoring ([competitions.ts](../src/core/competitions.ts)), which also fixes the single optimum.
2. Wire the axolotl's "recorded only" loci: maturity timing → maturity, feeding drive → food competition in the worker and growth share, regeneration → used by the injury/regeneration feature.
3. Let the color collector's price scale with **lineage scarcity** (living carriers of an origin), not just morph rarity.
4. Add "Advance to next hatch" to the calendar split button.

### 2.5 Core loops after the revamp

| Loop | Length | Beats |
|---|---|---|
| Moment | 10–60 s | Watch, feed, spot a weird kid, hover a locus, check a carrier badge |
| Session | 15–40 min | Hatch reveal → triage → set a program → take a commission → enter a themed show → map one locus |
| Lineage | 3–10 sessions | Discover a mutation → fix it → purge load → register a bloodline → win a standard |
| Meta | Weeks | Complete the Atlas, fill the Codex, unlock tools, diverge biomes, **name a species**, top the Weekly Genesis |

### 2.6 Design risks

- **Complexity overload.** Mitigate with Discovery mode (the complexity is revealed as it is learned), Scientist mode for experts, and plain-language explanations on every outcome (the project's existing honesty principle).
- **Load feels unfair.** Mitigate by always naming the cause and offering screening, purging and outcross help.
- **Automation removes the play.** Gate Programs behind hand-breeding and make the reveal and discovery moments impossible to automate away.
- **Ethical tone.** "Playing god" with cute animals: keep rehoming as the default sink, make mortality opt-in, and frame tools scientifically, not cruelly.

---

## 3. Senior web developer's review

### 3.1 Pros

1. **Clean separation.** The genetics core is pure TypeScript with no React, Canvas or storage. AGENTS.md enforces it. Epoch runners, headless balance tools and a future server validator can reuse it as is.
2. **Determinism and replay.** Seeded streams per chromosome block, a command envelope with revision and idempotency, and a bounded journal with checkpoints. This is better engineering than most shipped indie sims.
3. **Validation at the boundary.** Zod command schemas; atomic commands; `decodeSave` refuses inconsistent ledgers and origins.
4. **Resilient persistence.** IndexedDB, two backups, a Web Locks single-writer lease, and import preview that never overwrites silently.
5. **Real test culture.** 317 tests, scenario harnesses that use live commands only, frozen legacy fixtures and measured performance reports (FS-701, FS-702).
6. **Off-main-thread motion** in a worker with a typed protocol.

### 3.2 Cons and technical debt

| Issue | Evidence | Impact |
|---|---|---|
| **O(world) per command** | `applyCommand` calls `structuredClone(world)`: 2 ms at 80 records, **85 ms at 2,006** (FS-702) | Breeding Programs and big archives will hitch on every action. **Blocker for the revamp.** |
| **Expression is recomputed often** | `express()` / `metabolicPotential()` are called per fish per day, in scoring and pricing; the koi version runs `LOCI.indexOf` per trait | Epoch runs of thousands of births will burn CPU |
| **Genetics hard-coded as formulas** | Koi `express` is ~40 lines of literal arithmetic; axolotl is a separate module; `Phenotype` is koi-shaped with an axolotl compatibility projection | Every new species or trait means TypeScript work plus migrations; it cannot scale to "many species" |
| **Version ballast** | World v15, genome v1–3, price models 1–2, shop models 1–2, legacy commands kept for replay | Each feature pays a migration tax; the revamp's genome v4 will add more |
| **God component** | `App.tsx` is 1,030 lines and owns calendar, commands, saves and the palette | Slows UI iteration and makes the reveal/program UI harder to add |
| **Canvas 2D ceiling** | 0.25–0.32 ms per fish; 19 ms at 60 fish (FS-701) | Module-graph anatomy and bigger tanks need GPU batching |
| **Fonts from Google** | IMPLEMENTATION_STATUS | Offline/PWA first load uses fallbacks |

### 3.3 Architecture proposals

#### A. A data-driven species engine ("Genesis DSL")

Describe each species as data, validated by Zod and versioned:

```ts
// species/koi.genesis.ts (sketch)
export const KOI = defineSpecies({
  id: 'koi', version: 4,
  chromosomes: [{ id: 'K1', label: 'Body', lengthCm: 80, loci: ['body_length', /* … */] }],
  loci: {
    body_length: { kind: 'quantitative', alleles: FOUNDER_6, dominance: 'additive', mutation: { rate: 0.003, model: 'gaussian', sigma: 0.08 } },
    crest_gate:  { kind: 'switch', alleles: ['on', 'off'], dominance: 'dominant' },
  },
  traits: {                       // phenotype parameters the renderer consumes
    finLength: { base: 0.3, from: [['tail_length', 0.62], ['fin_gain', 0.2]], gate: 'crest_gate', bounds: [0.1, 0.95] },
    swimSpeed: { from: [['thrust', 0.5]], penalties: [['finLength', -0.4]] },
  },
  plasticity: { 'color.red': { food: 'carotenoid', gain: 0.25 } },
  load: LOAD_CATALOG_KOI,
  modules: KOI_BODY_PLAN,         // module graph for anatomy
});
```

- One generic `inherit`, `express` and `develop` interpret any species definition. Koi v1–v3 and axolotl v1 stay as **frozen legacy interpreters** so stored fish never change. All new species and genome v4 go through the engine.
- **Benefits:** new species become content work (shrimp, betta, guppy, dragonfly nymph, *player-created species after speciation*). Trait tuning becomes data diffs. The Atlas UI reads the same definitions.
- **Performance:** compile each definition into a flat `Float32Array` effect matrix plus an index plan, and express genomes as matrix-vector products. Memoize phenotypes by `fingerprint` (an LRU or a `Map` keyed by genome hash; genomes are immutable).

#### B. Fix the command layer before scaling

- Replace `structuredClone(world)` with **structural sharing**: commands return new objects only along the paths they touch (Immer's `produce` with frozen state, or hand-written copy-on-write helpers).
  - Atomicity is preserved because a failed command throws before the draft is committed.
  - Target: under 2 ms per command at 10,000 records.
- **Normalize the world:** `fish: Record<id, Fish>` plus per-tank indices instead of arrays scanned with `find` and `filter`. `advanceClutches` and `developResidents` currently do several O(n) scans per day.
- **Split archive from living.** Archived records are immutable, so store them in a separate IndexedDB object store, paged, and keep only living fish plus recent history in the hot world.
- Keep the existing **cost-curve regression test** from FS-702 as the acceptance gate.

#### C. Simulation scaling for Epochs and Programs

- Run epochs in a **dedicated sim worker** that holds a copy of the world, executes program commands and posts progress snapshots (trait histograms, F, allele counts) every N generations. The UI commits the final world as a single journaled `run-program` command whose result is reproducible from seed, program and start revision. Replay re-runs it, so the journal stays compact.
- **Packed genomes:** `Uint8Array` per copy (and `Uint16Array` once open-ended alleles exist). 66 loci plus 200 micro-loci is about 0.5 KB per fish, which is fine for 10k records.
- **SharedArrayBuffer is optional** and needs cross-origin isolation headers. Keep it as an optimization, not a requirement.

#### D. Rendering roadmap

- Adopt the **PixiJS escape hatch** already measured in FS-701 (20–40× faster, identical pixels), now that the trigger is met: module anatomy and bigger tanks.
  - Keep vector generation in Canvas/OffscreenCanvas per phenotype, rasterize to a texture atlas per growth stage, and let Pixi batch the sprites.
  - The aquascape stays Canvas 2D as a background texture at first, then ports gradually.
- **Archival portraits:** store a WebP snapshot per notable fish in IndexedDB at registration, win or death. The GDD already asks for this so renderer upgrades never erase history.
- **Evolution time-lapse export:** render the Tree of Life or the lineage portrait strip to a canvas → `MediaRecorder` → WebM/GIF. This is a marketing feature (see §4).

#### E. Platform and distribution

- **PWA:** self-host fonts, add a service worker for offline play and make it installable. Low effort, high polish.
- **Desktop:** wrap with **Tauri** (small binaries) for Steam. IndexedDB stays, with an optional file-system save mirror for Steam Cloud.
- **Share codes:** a compact base64url encoding of `{species, genomeVersion, genome, name, lineage hash}` plus a QR code. Imported shared fish land as **sandbox-marked** (the AGENTS.md rule: local worlds are untrusted).
- **Weekly Genesis Challenge without an economy server:** publish a seed and rules as static JSON. Players submit their *journal*; a tiny serverless verifier (e.g. Cloudflare Worker, reusing the pure core) **replays it** and posts the score. Determinism makes cheating hard without trusting the client's world. Scope it carefully: replay must run under the worker's CPU limits, so cap generations per challenge.

#### F. Quality and process

- **Property-based tests** (fast-check) for the engine: Mendelian ratios under dominance, linkage distances, bounded traits for any allele vector, no invalid anatomy for any module combination.
- **Golden phenotype snapshots** per species definition version, as with the existing frozen fixtures.
- **Split `App.tsx`** into feature controllers (calendar, commands, saves, overlays) behind a small store (Zustand or `useSyncExternalStore` over the runtime). The reveal, Atlas and Program UIs then become isolated features.
- **Opt-in telemetry** (local-first, explicit consent): generations bred, time to first mutation, reveal triage choices. These are needed for balancing and marketing KPIs.
- **Consider a save-line reset for v1.0:** "Genesis worlds" start at world v16 with the new engine, and a one-way importer converts v15 worlds. Legacy replay code then moves to an `import/legacy` package instead of living in every hot path.

### 3.4 Effort estimates (one experienced developer)

| Work | Estimate |
|---|---|
| Structural-sharing command layer + normalized world + archive store | 2–3 weeks |
| Genesis DSL + generic interpreter + frozen legacy adapters | 4–6 weeks |
| Genome v4 features (dominance, epistasis, pleiotropy, load, plasticity, noise) | 3–4 weeks |
| Open-ended allele table + save migration | 2 weeks |
| Hatch Reveal UI | 1–1.5 weeks |
| Breeding Programs + epoch worker + charts | 3–4 weeks |
| Genome Atlas discovery UI | 3 weeks |
| PixiJS renderer migration | 3–5 weeks |
| Module-graph anatomy (first 6 modules per species) | 4–6 weeks |
| Speciation + Tree of Life | 3 weeks |
| PWA, share codes, time-lapse export | 1.5 weeks |
| Weekly challenge verifier | 1–2 weeks |

---

## 4. Marketer's review

### 4.1 Pros (sellable truths)

- **"Every creature is one of a kind, and has a family tree."** This is true, provable and rare. It is the headline.
- **Axolotls.** They are one of the most beloved animals online (Minecraft mob, plushies, TikTok). Leucistic, golden albino and melanoid morphs are already recognizable to fans.
- **Deep but honest science.** It appeals to creators who explain genetics (science YouTube, education), not just players.
- **Beautiful, calm aesthetic.** The Deepwater UI and procedural animals screenshot well. This is "cozy" with brains.
- **No gacha and no pay-to-win genetics** can become a trust message in a genre full of both.

### 4.2 Cons (market problems)

- **The name "Fishtank Sim" is generic and unsearchable,** and it undersells axolotls and the god fantasy. It sounds like a screensaver.
- **No hook visible in 5 seconds.** A screenshot of a tank doesn't say "you create new life". The magic (lineage, mutation, speciation) is invisible on a store page.
- **"Research lab" framing** reads as homework. The current UI labels are honest (good), but the pitch needs fantasy first, science second.
- **No shareable output.** Nothing leaves the game, so there is no organic loop.
- **Unclear audience and business model,** and the GDD lists both as open decisions.

### 4.3 Positioning

**Category:** a cozy evolution sandbox. Breeding sim × creature collector × living aquarium.

**One-liner options:**
- *"Breed axolotls and koi with real genetics, discover mutations nobody has seen, and evolve your own species."*
- *"Every egg is a surprise. Every creature has a family tree. Every species you create is yours."*

**Candidate names (check trademarks and domains):** **Gene Pond**, **Axolab**, **Lineage: Deepwater**, **Tidewright**, **Primordia Tank**, **Spawnline**. Our joint favorite is ***Gene Pond***: short, punny, searchable, and it covers both species and future ones.

**Comparables for pitch decks:** *Spore* (creation fantasy), *Pokémon* breeding / *Palworld* (breeding depth), *ARK* mutation stacking, *Chicory*/*Unpacking* (cozy aesthetic), *Kinder World* and *Ooblets* (cozy care), *Niche – a genetics survival game* (closest genre peer: learn from its reviews; it proved a market for genetics-forward indie games).

### 4.4 Audience segments

| Segment | What they want | Hook |
|---|---|---|
| Cozy-sim players | Calm, beauty, low pressure | Sanctuary mode, aquascaping, gentle reveals |
| Creature collectors / breeders | Rarity, completion, min-max | Codex, open-ended alleles, Most Novel shows, Weekly Genesis |
| Axolotl and aquarium fans | Their favorite animal, done right | Real morphs, metamorphosis, regeneration |
| Science-curious, students, teachers | Learn genetics by doing | Genome Atlas, test crosses, linkage mapping |
| Streamers / creators | Audience participation, moments | Chat-voted pairings, hatch reveals, time-lapses |

### 4.5 Growth features (build these on purpose)

1. **Share cards:** one-click PNG of a creature (portrait, name, generation, signature mutation, mini pedigree, share code). Twitter/X-, Reddit- and Discord-sized.
2. **Evolution time-lapse export:** "100 generations in 15 seconds" vertical video. This is TikTok/Shorts native and the strongest organic asset possible.
3. **Weekly Genesis Challenge:** the same founders and the same seed for everyone; "breed a violet crown tail in the fewest generations". Replay-verified leaderboard. It creates recurring news, community and content.
4. **Twitch integration (later):** chat votes on pairings; the hatch reveal on stream.
5. **Name-your-species moment:** prompt a share when a player speciates. "I created *Axolotlus mariones*." This is the peak-emotion moment, so attach the share there.
6. **Codex firsts:** "You are the first to discover *Inkblot Crown* in your world." Keep it local and honest (not a global claim until a server exists, per the AGENTS.md rules).

### 4.6 Go-to-market plan

| Phase | Action | Goal |
|---|---|---|
| Now–2 months | Rename; capsule art with an axolotl hero; landing page with email list; devlog "how our genetics work" posts on r/proceduralgeneration, r/axolotls, r/IndieDev | 2–5k wishlists/emails |
| Months 2–4 | Free **web demo on itch.io** (Sanctuary mode, 1 species, Hatch Reveal, share cards); TikTok time-lapse series; outreach to science and cozy creators | Viral proof; demo retention data |
| Months 4–6 | **Steam page + Next Fest** demo; Weekly Genesis beta; Discord | 10k+ wishlists |
| Release | Early Access premium; species packs post-launch | Sustainable revenue |
| Parallel | **Education edition** pitch: Mendel lab lesson plans built on the Atlas (B2B or schools) | A second revenue stream with low marketing cost |

### 4.7 Monetization (recommended)

- **Premium**, $14.99–19.99 Early Access, with a free web demo.
- **Expansion species packs** ($4.99–7.99): betta, guppy, shrimp, newts, and a "deep-sea weirdos" pack. The Genesis DSL makes these content work.
- **Cosmetic aquascape packs** and a supporter pack with a soundtrack and artbook.
- **Education licenses.**
- **Avoid:** NFTs or blockchain (it destroys trust in this audience), real-money fish trading, paid rerolls, paid mutation boosts. The deterministic, honest genetics is the brand.

### 4.8 KPIs

- Time to first hatch reveal (< 5 min) and to first visible mutation (< 30 min, in a tutorial line seeded for it)
- D1/D7/D30 retention; generations bred per session
- Share-card and time-lapse exports per 100 DAU (organic coefficient)
- Weekly Genesis participation rate
- Wishlist conversion from demo

### 4.9 Messaging guardrails (with the team's honesty rules)

AGENTS.md forbids labeling the product as a biological koi simulator. Marketing should say **"genetics-driven"**, **"inspired by real biology"** and **"real inheritance mechanics"**, never "scientifically accurate koi/axolotl genetics". This is a strength: "We modeled the *mechanisms* (dominance, linkage, mutation, inbreeding, speciation), not a textbook" is credible and invites science creators instead of nitpickers.

---

## 5. Joint revamp roadmap

### Phase 0: Foundations (4–5 weeks)

- R-001 Structural-sharing command layer, normalized world, archive store (FS-702 follow-up). *Gate: under 2 ms per command at 10k records.*
- R-002 Phenotype memoization by fingerprint; packed genomes.
- R-003 `App.tsx` split into feature controllers.
- R-004 Quick wins: theme-driven judging; wire the axolotl maturity and feeding-drive loci; "Advance to next hatch".

### Phase 1: Biology that bites (6–8 weeks)

- R-101 Genesis DSL + generic interpreter; koi v1–3 and axolotl v1 frozen as legacy adapters.
- R-102 Genome v4: dominance, epistasis modules, pleiotropy and trade-offs, micro-loci, developmental noise.
- R-103 Genetic load, inbreeding depression, heterosis, carrier screening.
- R-104 Plasticity: temperature, food and substrate effects on expression.
- R-105 Hatch Reveal ceremony.
- *Gate:* a blind playtest where players say breeding decisions "mattered", plus measured selection response that is non-linear compared with the v3 baseline.

### Phase 2: Discovery and creation (8–10 weeks)

- R-201 Open-ended alleles and the Allele Registry.
- R-202 Genome Atlas (Discovery mode) and Codex.
- R-203 Module-graph anatomy (first modules: second dorsal, wen, bubble eye; polydactyly, extra gill ramus, crest).
- R-204 PixiJS renderer migration.
- R-205 God Tools tier 1: sequencer, cryobank, mutagen lamp.

### Phase 3: Scale and meta (8 weeks)

- R-301 Breeding Programs + epoch worker + evolution charts.
- R-302 Speciation, hybrid chamber, Tree of Life.
- R-303 Ecosystem mode (mortality, predators, biomes, disease resistance).
- R-304 Commissions, rotating standards, the Most Novel division, expeditions.
- R-305 God Tools tier 2: cloning, gene editor, metamorphosis trigger; reputation axes.

### Phase 4: Go to market (in parallel from Phase 1)

- R-401 Rename + brand + landing page.
- R-402 Share cards, time-lapse export, PWA.
- R-403 itch.io web demo → Steam page → Next Fest.
- R-404 Weekly Genesis verifier.
- R-405 Education edition pilot.

### Keep, cut and park

| Keep and invest | Freeze (maintain only) | Park until after launch |
|---|---|---|
| Lineage, origins, bloodlines, prediction, determinism, saves | Aquascape item catalog, NPC negotiation polish, care equipment tiers | Server-owned market, multiplayer trading, real-money anything |

---

## 6. Open questions for you

1. **Mortality:** keep Sanctuary (no death) as the default with Ecosystem as opt-in? We recommend yes.
2. **Discovery vs. transparency:** should the Genome Atlas be the default, with full genome view as "Scientist mode"? We recommend yes.
3. **Compatibility budget:** are you willing to start a new save line ("Genesis worlds") for v1.0, with a one-way importer, to shed migration ballast?
4. **Hero species:** lead marketing with axolotls?
5. **Name:** open to renaming from "Fishtank Sim"?
6. **Business model:** premium + species packs + education, as proposed?

---

### Appendix: code references

| Topic | File |
|---|---|
| Koi inheritance and expression | [genetics.ts](../src/core/genetics.ts), [catalog.ts](../src/core/catalog.ts), [registry.ts](../src/core/registry.ts), [appearance.ts](../src/core/appearance.ts), [structure.ts](../src/core/structure.ts) |
| Axolotl genome | [axolotlCatalog.ts](../src/core/axolotlCatalog.ts), [axolotlGenetics.ts](../src/core/axolotlGenetics.ts) |
| Day loop | [habitat.ts](../src/core/habitat.ts), [runtime.ts](../src/core/runtime.ts) |
| Development and condition | [development.ts](../src/core/development.ts) |
| Breeding and clutches | [breeding.ts](../src/core/breeding.ts) |
| Pricing | [economy.ts](../src/core/economy.ts) |
| Competitions | [competitions.ts](../src/core/competitions.ts) |
| Goals and odds | [breedingGoals.ts](../src/core/breedingGoals.ts), [prediction.ts](../src/core/prediction.ts) |
| Behavior | [behavior.ts](../src/simulation/behavior.ts) |
| Commands | [world.ts](../src/core/world.ts) |
