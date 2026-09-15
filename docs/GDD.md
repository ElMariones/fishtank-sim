# Fishtank Sim — Game Design Document

**Design version:** 0.1 · **Date:** 13 September 2026 · **Status:** proposed product baseline, with a working research prototype.

This document describes the intended game. It does **not** claim that every system exists. See [implementation status](IMPLEMENTATION_STATUS.md) for the actual build, [genetics](GENETICS.md) for mathematical rules, and [roadmap](ROADMAP.md) for sequencing. Numerical settings are initial design hypotheses unless explicitly identified as implemented constants.

## 1. The promise

Raise a living aquarium. Discover a fish worth keeping. Breed it, understand what made it special, and follow its descendants until an ordinary koi becomes the ancestor of something extraordinary.

The collectible is an individual with a history, not a predefined species card. A spectacular fish should be explainable through its parents, inherited alleles, developmental conditions, and mutations. Players create recognizable bloodlines through selection; the game never needs a predefined “Ivory Dragon Fish” item.

**Product pillars**

1. **Fish first.** Observing fish must be enjoyable even when the player does nothing. Swimming, reactions, appetite, hiding, and social relationships make specimens feel alive.
2. **Inheritance you can see.** Children resemble their family while offering meaningful surprises. Traits affect both appearance and life in the tank.
3. **Every fish has a story.** Names, births, ancestors, homes, owners, and descendants remain connected across the life of a save.
4. **Care enables potential.** Genes define possibilities; habitat and development influence what is achieved. Good care supports unusual fish rather than forcing a single optimal morphology.
5. **Depth without compulsory homework.** A casual player can breed by appearance. An expert can inspect phased chromosomes, carrier status, pedigree, and measured trait distributions.

**Audience:** aquarium observers, creative breeding players, collection and management players, and simulation enthusiasts. Desktop browser first, touch-compatible inspection and management. Initial audience language: English; prepare strings for later Spanish localization.

**Genre:** contemplative aquarium management with an experimental genetics sandbox. Scientific inspiration with explicitly fictional developmental rules. It is not a real koi husbandry or genetics reference.

## 2. Analysis of the original concept

The supplied notes correctly place genotype-to-appearance ahead of shops and progression. Keep the 2D procedural approach, living identity, inherited behavior, archive navigation, and tank specialization.

| Original idea | Design adjustment | Reason |
|---|---|---|
| 50–100 loci from the beginning | Start with 48 stable loci; add 24 developmental/behavioral loci behind a new genome schema | Prove expression and inheritance before expanding a large silent gene catalog |
| Enormous genotype count proves variety | Measure visible distinguishability and selection response separately | Many genotypes can look identical; a large exponent is not a content-quality metric |
| Global rarity and top-percent uniqueness | In solo play use a named reference population and save-local carrier counts | An offline client cannot know a global population |
| Mutations in every subsystem | Start with adjacent allele changes; gate topology changes behind validated anatomy templates | Arbitrary geometry mutation can produce broken silhouettes and unusable fish |
| Multiplicative market value | Use bounded, auditable contributions and demand budgets | Unbounded products cause inflation and make rare fish universally optimal |
| Brother/sister breeding is automatically harmful | Calculate pedigree F; phenotype damage comes from modeled recessive burden | F is a probability of identity by descent, not a direct health percentage |
| Thousands of individually simulated eggs | Reserve a bounded nursery cohort before spawning | Prevent exponential population growth and data creation |
| Real-time absence can advance everything | Default to protected, capped offline catch-up; hard mode is opt-in | A relaxing game should not punish a player with an unobserved mass loss |
| Deterministic fish never need images | Keep versioned reconstruction inputs **and** optional archival portraits | Renderer changes should not erase the visual history of a prized ancestor |
| “Line purity” as one percentage | Show pedigree contribution and similarity to a registered trait standard separately | Ancestry, allele identity, and phenotype resemblance are different measurements |
| Two fish always produce children | Guaranteed accelerated lab crosses; transparent compatibility in the game | Supports debugging now and meaningful behavior later without opaque rejection |

The prototype is intentionally an experiment bench. It generates adult previews instantly and exposes all loci. This supports fast evaluation; it is not the final time progression or economy.

## 3. Modes and scope

### Research lab — included foundation

Two parents, a cohort of twenty genetically distinct offspring, repeated selection, aquarium visualization, inspection, and a navigable pedigree. Free tank creation and free breeding are deliberate research conveniences. Local NPC credits only demonstrate ownership transitions.

### Solo aquarium — first playable target

Persistent tanks, meaningful care, life stages, controlled breeding, NPC economy, decoration placement, lineage notebook, validated save import/export, and recovery. All decisions are local; no account required.

### Shared economy — later product

Online identity, server-owned fish, authorized listings, atomic currency/ownership transactions, public or private pedigree views, marketplace filters, and rarity measurements scoped to a season.

Keep sandbox/imported fish in a separate world from trade-eligible fish. A local save can be edited, rewound, or accelerated. It cannot be promoted into trusted market inventory.

### Explicit early exclusions

3D camera navigation, fully accurate aquatic fluid dynamics, real koi chromosome mapping, disease epidemiology, procedural unlimited limb creation, live synchronous multiplayer tanks, real-money fish purchases, auctions, competitive prizes, user-uploaded decoration meshes, and native mobile applications.

These are scope boundaries for the first releases, not permanent prohibitions.

## 4. Player loops and pacing

**Moment to moment, 10–60 seconds:** observe a fish, inspect a behavior, distribute food, examine a marking, choose a relative, or adjust the view.

**Session, 10–30 minutes:** check tank alerts, compare siblings, select breeding candidates, improve one habitat, move juveniles, and sell or rehome surplus.

**Lineage, several sessions:** establish a target, cross founders, discover carriers, select offspring, outcross when useful, and compare generations.

**Long term:** register a bloodline, satisfy collector requests, fill a mutation notebook, breed a fish adapted to an unusual habitat, or trace a spectacular descendant back through dozens of generations.

### Proposed first-session sequence

1. Open directly on a planted tank with six unrelated adult koi and room for a first nursery cohort.
2. Select Haru. Rename her. Inspect the large procedural preview.
3. Feed once; identify which fish approaches first.
4. Compare Haru and Sumi. The breeder shows inherited size range, visible trait tendencies, and expected pedigree F.
5. Reserve nursery capacity and initiate a cross.
6. Watch courtship or use a tutorial-time compression preset. Explain which conditions are missing if it stalls.
7. Hatch a small cohort and observe markings emerging. Keep two interesting juveniles.
8. Transfer one to a lineage tank; open Family and return to the mother.
9. End the tutorial with a voluntary breeding goal, not an obligation to log in later.

**Lab implementation (FS-504):**
- **Guide:** a seven-step first-session guide follows this sequence in the ordinary lab world: select, rename, feed, court, keep a hatched offspring, follow a parent and set an optional goal. It has no tutorial time compression. Its pointers only move focus, and it ends without asking the player to return.
- **Family:** parent links sit under every fish's name.
- **Koi rescue:** when every fish of one sex is gone and credits cannot buy stock, the rescue gives one unrelated adult of each missing sex, at most once every 10 game days, so the economy has no permanent dead end.

**First playable pacing hypothesis:** one game day per 60 real seconds at 1×; 1×/4×/12× time controls; maturity around 18–30 game days under healthy development; incubation 2–4 game days; juvenile pattern reveal over approximately 6–12 game days. This implies a first generation in roughly 20–35 minutes at normal speed, much faster with compression. These numbers are game rules awaiting playtests, not biological facts.

Behavior uses real simulated seconds. Growth and care use explicit game-day units. Pausing stops both. Camera animation does not determine authoritative time.

## 5. Fish identity and lifecycle

Every fish has an immutable ID, immutable parents, birth time in world ticks, genome and development versions, birth seed, origin world, and provenance events. The player may edit its display name. A genome checksum supports debugging; an ID, not that checksum, establishes identity.

**States:** egg → fry → juvenile → adult → elderly → dead. Ownership state is separate: owned, listed, transferred, or archived. An egg is not an available breeder or sale listing.

**Growth:** estimate adult length from several loci, then integrate growth according to age, nutrition, oxygen, stress, and health. Current size must never be substituted for genetic potential. The inspector labels current length, estimated mature range, and environmental limitations independently.

**Color development:** early fry show simplified pigment. Juvenile markings gradually approach genetically specified pigment layers. Environmental pigment intensity can vary within bounds without changing DNA. The current lab (FS-306) reveals pigment, motifs and scales between game days 5 and 15 and eases hatchling proportions toward the adult as fish grow; environment does not yet change pigment intensity.

**Sex and reproduction:** start with fictional fixed female/male reproductive roles for the koi ancestry. Preserve room in the model for other systems later; do not pretend these initial roles or inheritance match real koi sex determination.

**Health:** show actionable condition, a trend, and the reason. Examples: “Low oxygen: add aeration or reduce biomass” or “Underfed: more feeding access needed.” Never silently reduce health because a fish has an unusual silhouette.

**Death and absence:** standard mode protects fish during extended absence and provides a return summary. Challenge mode may include mortality after explicit selection of its rules. Death preserves immutable lineage and an archival portrait. Avoid mandatory lethal culling; offer ethical rehoming as an economy-neutral population sink.

## 6. Genome, rarity, and discovery

The full algorithm is specified in [GENETICS.md](GENETICS.md). The central pipeline is:

```text
Phased diploid genome + version
          ↓
Developmental parameters + birth seed + development history
          ↓
Phenotype (anatomy, pigments, size potential, physiological traits)
          ↓
Physical constraints + behavior weights
          ↓
Simulation and procedural renderer
```

Alleles are stable identifiers in a versioned registry. Most early loci blend continuously; selected switches have documented dominant/recessive behavior. Later interactions include codominant pigment layers, regulatory modifiers, and developmental topology gates.

**Mutation:** most births carry ordinary parental combinations. Small new variations occur at explicit per-copy rates. A rare structural mutation opens a bounded new structure, such as an additional tail lobe, which later selection can exaggerate. Record the exact altered allele and original mutation event; a mutation is a lineage fact, not just a purple label.

**Three rarity views**

- **Allele frequency:** measured among chromosome copies in a declared population, date, and sample size.
- **Phenotype unusualness:** distance/density among normalized visible descriptors. It does not mean a fish is beautiful or valuable.
- **Lineage scarcity:** living recorded carriers of a specific inherited mutation event or registered line.

**Presentation bands:** Common, Uncommon, Rare, Exceptional, Singular. These label a **specified measurement**, never the entire fish’s intrinsic quality. Proposed reference-frequency bands: ≥10%, 1–10%, 0.1–1%, 0.01–0.1%, <0.01%. Show “insufficient sample” when resolution does not support a band. Do not label a newly generated offline fish globally unique.

All genes are visible in sandbox. A later discovery mode can hide unsequenced alleles while leaving the underlying truth fixed; sequencing reveals data, it never rerolls genes. Display uncertainty without giving falsely exact probabilities.

## 7. Breeding, selection, and population management

### Controlled cross

Select parents, a nursery, and a desired cohort budget. Check ownership, status, sex, maturity, health, fertility cooldown, and nursery reservation atomically. Show compatibility contributors and potential outcomes before starting.

In normal play, fish need access to a shared breeding habitat. Moving parents should be a deliberate action with an acclimation period. Courtship utility incorporates environmental readiness, personality, and bounded mate preferences. It can delay a cross, but players can understand and improve it.

### Natural breeding

Optional per tank; off by default. Requires an explicit nursery policy, a maximum active clutch count, and a destination. Once full, no additional births are created. Decorations may provide spawning sites but do not bypass capacity.

### Cohorts

A narrative clutch can report many eggs while only a reserved subset becomes tracked fish. The retained set must be chosen independently of hidden desirable genotypes. Reserve enough slots for the entire tracked cohort before conception. Explain non-retained eggs as managed hatchery disposition, not an invisible loss of secretly generated rare fish.

For the first playable, cap tracked offspring at 8–24 per cross. Let the player compare a cohort side by side, sort by a phenotype descriptor, mark favorites, and rehome selected fish after reviewing the count and names.

### Genetic guidance

Provide trait distributions, not guaranteed promises. For a simple isolated locus, show exact Mendelian probabilities. For linked/polygenic traits, use a seeded preview sample and label its size and uncertainty. Never consume the authoritative birth random stream for previews.

### Inbreeding and outcrossing

Display pedigree F, heterozygous loci, and known recessive burden separately. Full-sibling crosses from unrelated non-inbred parents give expected offspring F = 0.25; first-cousin crosses give 0.0625. These are algorithm fixtures under stated pedigree assumptions, not universal advice.

Outcrossing can reduce inherited coancestry and add alleles, but it can also dilute a desired trait. Pairing recommendations optimize a declared goal with diversity as one consideration. Avoid a single universal “best match” ranking.

## 8. Living fish behavior

Use a utility system with interruptible states: cruise, forage, approach food, eat, school, investigate, hide, court, flee, rest, and recover. Separate desire selection from steering.

Each state exposes a short explanation in the inspector: “Foraging · hungry,” “Hiding · low boldness + bright light,” or “Following Sumi · high sociability.” Inherited tendencies are distinct from observed behavior and learned associations.

**Steering:** desired heading, acceleration and turning limits; boundary avoidance; obstacle avoidance; local separation; optional cohesion/alignment; state target. Favor smooth turns over teleporting directions. Spatial hashing bounds neighbor searches.

**Memory:** recent threat decays; feeding locations can become familiar; new decorations temporarily attract curious fish. Learned memory is not inherited.

**Morphology effects:** tail area increases drag and display appeal, body mass changes food/oxygen demand, streamlined form supports efficient movement, fin geometry changes turning, and specific modeled vulnerabilities interact with conditions. Large eyes do not automatically create arbitrary injury rolls.

**No universal fitness score:** a fish may excel in a display tank and perform poorly in strong current. Show habitat-specific suitability and its contributors.

The current lab implements utility cruise/forage/eat/hide/school, visual pellet consumption, startle response, inherited movement modifiers and inspectable reasons. FS-304 adds spatial neighbor queries, shared permeable plant cover and solid rock footprints with body-center clearance; extreme fins may overlap. Persistent feeding and user decoration placement remain planned. Curiosity is inspectable but does not yet select behavior.

## 9. Tank simulation and decoration

Each habitat records volume, usable area, temperature, dissolved oxygen proxy, waste/ammonia proxy, filtration, flow, lighting, substrate, plants, shelters, food, and residents. Display understandable player labels while keeping units explicit in code.

**Capacity:** the final game evaluates biomass and usable space, not only fish count. Reserve expected juvenile capacity for planned cohorts. Use a soft stocking warning plus hard spawning/import limits; never lose fish because moving them exceeded an invisible threshold.

**Water model:** feeding and waste add load; filtration removes it within capacity; aeration restores oxygen toward saturation; fish respiration and decay consume oxygen. Temperature modifies bounded rates. Start with a comprehensible one-compartment model; do not build a fluid simulation.

**Management:** feed measured portions, remove leftover food, change water, adjust target temperature, install filters/aeration, and move fish. Controls show cost and effect before applying.

**Decoration:** plants create cover and break sight lines; rocks/caves supply shelter; current devices create preferred flow zones; substrates influence visual context and spawning suitability. Initial placement uses a 2D coordinate and rotation with explicit collision/cover footprints. Separate cosmetic detail from functional footprint.

**Current lab (FS-305):** per-tank feeder rations, filter and aeration tiers, a thermostat, manual feeding and water changes, with cost and projected effect shown before applying. Warnings name the cause, fish affected and fixes. Poor care lowers condition and slows growth; fish never die. Food has no recurring cost in the lab (ADR-046).

**Tank roles:** display, nursery, controlled breeding, outcross stock, specialist lineage, and quarantine. Roles are presets, not hard-coded categories preventing experimentation.

**Transfers:** choose one or multiple fish and a destination. Preview added biomass, space, and temperature difference. Commit all selected transfers atomically, or explain why none moved. Clicking a relative can navigate between tanks without transferring it.

## 10. Economy and marketplace

### Solo NPC economy

One earned currency, no paid mutation rolls. Sources: bounded collector orders and surplus sales. Sinks: tanks, equipment, food, sequencing if enabled, listing costs, and decorations. Avoid upkeep that can strand a player permanently; provide a basic habitat, starter food safety reserve, rehoming, and affordable outcross stock.

NPC breeders offer unrelated founders, common visible variants, and occasional documented carriers. Shop stock has stable IDs and expiration ticks; opening the shop does not reroll it. Basic fish purchase prices exceed guaranteed immediate resale.

Collector requests reward different descriptors: elegant long tails, low-maintenance fish, unusual pigment boundaries, tiny adults, or stable multi-generation traits. This distributes demand across morphologies.

**Lab implementation (FS-501):** economy model v1 has five NPC buyers: a corner pet shop for any hatched fish, a long-fin collector, a pond keeper who wants large, easy-to-feed adults, a miniature keeper and a color collector.
- **Demand and budgets:** each buyer takes a bounded number of fish, a limit that recovers every game day, and pays within a budget.
- **Offers:** each offer explains its terms. Fish bred here earn a capped bonus, and founders or bought stock never resell above ◈ 150.
- **Ledger and rehoming:** a ledger records every credit change, and rehoming is free.

Persistent shop stock, upkeep, tank prices and time-limited collector orders are still to come.

### Value model

Quote a range based on base category, visible traits, age/health eligibility, bounded rarity evidence, demand, and documented breeding results. Record the price-model version and explain top contributions. Actual sale price can differ. Prestige requires verifiable provenance and has a capped effect.

The lab’s fixed low NPC quote is plumbing only. Free accelerated offspring make the lab economy farmable by design; it must not become the solo or shared economy unchanged.

### Online market

Search by sex, stage, predicted size, pigment, head/body/tail descriptors, allele/carrier status, mutation provenance, named line, price, and relationship to a selected fish. Show stock provenance and uncertainty.

Listing a fish creates an ownership lock. It cannot breed, move, or sell elsewhere while listed. Buying must atomically check listing state, buyer funds, destination capacity, and version; debit/credit ledgers and ownership change happen together. Retries use idempotency keys. Expiry/cancellation releases locks.

Begin with fixed-price listings. Auctions, bids, trade offers, messaging, and direct player payments are later independent decisions. There is no real-money economy in this design baseline.

## 11. Inspection, genealogy, and bloodlines

The inspector opens alongside the living aquarium, retaining selected fish and camera context. Enlarged fish use the same phenotype and renderer as the tank. A mature preview must be labeled if the actual animal is juvenile.

**Overview:** editable name, identity, age/stage, birth, sex, residence/status, current and potential dimensions, condition and trend, value estimate, and known mutations.

**Appearance:** silhouette measurements, pigment coverage, fins, head, eyes, mouth, size, and potential-versus-achieved development.

**Genome:** chromosomes and phased allele copies, expression rule, source parent, mutation, measurement scope, carrier status, and sequencing uncertainty if enabled.

**Family:** focus fish, parents, offspring, siblings, mates, expandable ancestors, and offspring branch counts. Clicking any node changes focus. Live owned fish highlight their tank; sold/dead fish show a read-only archive. External private records show a minimal tombstone without revealing private owner information.

**History:** append-only birth, rename, transfer, maturation, offspring, listing, sale, death, and lineage registration events. Distinguish world ticks from real timestamps.

**Behavior:** inherited tendencies, current state, observations with sample windows, and learned associations.

**Market:** quote date, comparable scope, sale eligibility, fees, and ownership provenance.

### Bloodline registration

Player names a line, chooses founder(s), and defines a trait standard. Record versioned target descriptors and contribution rules. Show:

- ancestry contribution from the registered founders;
- distance from the line’s trait standard;
- generation distance and number of observed descendants;
- trait stability among measured offspring.

Do not imply biological species status. Multiple lines may overlap in ancestry. Renaming a line must not replace the historical registration event.

## 12. Progression and long-term interest

Progression expands player options: more habitats, nursery automation, measurement tools, saved breeding goals, cohort comparison, better environmental control, and notebook visualization.

An extraordinary allele does not require buying a “legendary fish unlock.” Mutations and selection supply variation; tools improve understanding and capacity. Rare topology variants should appear often enough in extended testing to discover, with event rates tuned to the number of **tracked births**, not fake uninstantiated eggs.

Endgame goals include stabilizing a new silhouette, creating an efficient miniature line, preserving a founder pattern in unusual anatomy, restoring diversity without losing a fin structure, documenting adaptation in a current tank, or maintaining a living museum of generations.

## 13. Visual, audio, accessibility, and tone

Use a calm dark aquarium workspace with restrained mint accents and warm koi pigment. The tank dominates. UI typography is legible, measured data is aligned, and decorative water effects stay behind fish. Procedural anatomy must read before caustics and post-processing.

2D side view is the starting perspective, with depth suggested by scale, lighting, occlusion, and motion. Free 3D is unnecessary for the breeding proof. The later mesh renderer must share geometry and pattern data with portraits.

Subtle optional water ambience, feeding sounds, and restrained birth notifications. Sound is muted until the player enables it. No autoplay music required.

Keyboard users can select every fish from a list, navigate relatives, choose parents, and perform management without hitting moving targets. Provide visible focus, text rarity labels, sufficient contrast, reduced motion, pause, larger text, and touch targets around 44 CSS pixels for the first playable. A canvas is supplemented by meaningful DOM controls. Do not use color as the only mutation or warning signal.

Avoid pushy “come back now” notifications, countdown anxiety, fake scarcity, or language implying real biological precision.

## 14. Success criteria and risks

### Core proof gate

- In a blind comparison, players identify the correct parent pair more often than chance using offspring silhouettes/patterns.
- Ten selected generations shift at least three normalized descriptors beyond the starting cohort’s typical range.
- Offspring remain finite, renderable, and inspectable through at least 100 automated generations.
- Reopening a save preserves genotype, identity, parent links, and appearance version.
- A player can follow an ancestor from a child in another tank and return without losing context.

**Status (13 September 2026):** the selection-shift criterion passed for 6 of 6 traits in a seeded ten-generation experiment, and generation-10 offspring stayed renderable; see [FS-105 selection and resemblance](research/FS-105-SELECTION-AND-RESEMBLANCE.md). In the blind human comparison, five anonymous observers named the correct parent pair in 54 of 60 trials (full appearance 19/20, silhouette 20/20, markings 15/20). Every mode's 95% lower bound is above chance, so the criterion passes for the fixed trial set; markings are the weakest channel ([FS-111](research/FS-111-HUMAN-RESEMBLANCE.md)). The 100-generation evaluation (FS-702) has not been run.

### Product targets

At least 80% of first-session testers can select, rename, breed, and find a parent without instruction. Median first interesting retained offspring within one session. Stable care should take less time than observing and selecting. Market demand should support several trait strategies without one dominant resale exploit.

### Main risks

| Risk | Early signal | Response |
|---|---|---|
| Fish differ genetically but look alike | Players cannot tell siblings apart | Increase expression range selectively; measure visual descriptors |
| Fish stop looking coherent | Extreme anatomy clips or appears disconnected | Topology templates, anatomy bounds, adversarial render fixtures |
| Patterns conceal family resemblance | Children look like independent random skins | Increase inherited pattern structure; reduce birth-seed variation |
| Scale overwhelms browser | Long-frame spikes and huge save writes | Worker, spatial hash, phenotype cache, tiered simulation |
| Breeding creates chores | Players rehome hundreds of fish manually | Reserve small cohorts, batch comparison, safe population limits |
| Market eclipses caring | Optimal play is instant resale | Demand budgets, bounded rewards, non-economic lineage goals |
| Save/renderer drift | Old fish change unexpectedly after updates | Versioned phenotypes, migrations, archival image fixtures |

## 15. Open decisions with working defaults

| Decision | Working default | Revisit when |
|---|---|---|
| Biology versus fantasy | Fictional koi ancestry; bounded fantastical anatomy | Core visual proof succeeds |
| Mortality | Protected standard mode; optional challenge rules | Care prototype is understandable |
| Offline progress | Capped protected catch-up, no unlimited breeding | Persistence and cohort reservations exist |
| Genome reveal | All loci visible in sandbox | Discovery mode is playtested |
| Multiplayer priority | Solo first, separate trusted online world later | Solo retention and save robustness are demonstrated |
| Business model | Undecided; no paid gene power or real-money trading in baseline | Product strategy discussion |
| Target hardware | Desktop integrated GPU; mobile inspection and management | Reproducible benchmark environment chosen |

The next implementation should follow the milestone gates rather than treating every paragraph as an immediate requirement.
