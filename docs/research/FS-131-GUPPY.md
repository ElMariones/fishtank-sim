# FS-131 Guppies and Commissions: research, design and implementation

5 November 2026 · user request: "design a new feature and a new species, code them, integrate them, go over the ux/ui and
details, and deliver a new polished update … trust your judgement".

World v20 adds a fourth species, the **guppy**, and a new feature, **Commissions**: letters from NPC clients who ask for
one bred animal that shows a named Codex phenotype. Both are in the live game. Guppies can be bought, paired, carried
to term and born as live fry, colored up, sold, shown and delivered. Commissions turn the Codex into breeding goals with
deadlines, rewards and reputation.

The two were chosen together. The goldfish taught recessive body forms; the guppy teaches something the lab could not
show before: **sex-linked inheritance**. A commission that asks for "a son of this father's color" is a natural goal for it.

## 1. The real animal

The guppy (*Poecilia reticulata*) is a small livebearer from the streams of Trinidad, Venezuela and nearby. It is one of
the classic animals of evolutionary biology: Endler's predation studies in Trinidad streams, Winge's early work on
Y-linked color, and the fancy strains bred since the 1920s.

The features the game borrows, with how confident each is:

| Feature | Real basis | How firm |
|---|---|---|
| XY sex determination on linkage group 12 | Male heterogamety; sex region on LG12 | Firm |
| Male color is mostly sex-limited | Females carry the genes but show little; testosterone-treated females color | Firm |
| Y-linked color patterns pass father → son | Winge (1922, 1927): maculatus, armatus and others | Firm, with named alleles simplified |
| Rare X–Y crossover moves a Y gene onto the X | Winge reported crossovers of about 1–2% for some genes | Firm in kind; the rate varies by gene and strain |
| Recessive blond, golden, albino and blue (red-less) bases | Classic autosomal recessives used by breeders | Firm |
| Asian Blau dominant; Moscow and pingu on the Y | Breeder genetics, partly peer-reviewed | Moderate |
| Ribbon fins; ribbon males often cannot mate | Elongated gonopodium in ribbon males | Breeder-documented |
| Snakeskin on the sex chromosomes | Breeder-documented, can sit on X or Y | Moderate |
| Livebearing; broods every few weeks | Internal fertilisation, about 21–30 days gestation | Firm (the game compresses it) |

The game does **not** model sperm storage (real females give several broods from one mating), superfetation, the
mixed sex-determination systems of some wild populations, or predation-driven color evolution.

## 2. How the game models guppies

### Genome (guppy genome v1)

`src/core/guppyCatalog.ts` defines 72 loci on 12 synthetic chromosomes plus the shared development block. Nothing is
shared with koi, axolotl or goldfish loci, allele IDs or streams. Groups: body and gonopodium, tail and swords, fins
(dorsal, dumbo, ribbon, swallow, pelvic), base color, iridophores and Asian Blau, red and yellow pigment, tail patterns,
spots and half-black, life history, behavior, and chromosome 12, `GP-SEX`.

`GP-SEX` ends with the **sex locus**. Alleles 0–3 are X, 4–5 are Y. A male carries his Y on the **paternal** homolog;
`guppyGenomeProblem` rejects a maternal Y, a female with a Y, or a recorded sex that disagrees with the genome.
Next to it sit the **Y program** (none, maculatus, Moscow, armatus, pingu), double sword, snakeskin, red tail and a
pseudo-sheen locus near the free end of the chromosome.

Inheritance (`inheritGuppy`) runs the usual seeded meiosis, with one change on `GP-SEX` in males: the region next to
the sex locus is fully linked, so the Y program always goes to sons, and double sword crosses over at `WINGE_CROSSOVER`
(0.015). Pseudo-sheen recombines freely in both sexes.

### Expression

`expressGuppy` returns a phenotype with a body plan, tail shape (roundtail, spade, veil, delta, fan, swords, lyre and
others), fins, base color, iridophore layers, red and orange, tail pattern, spots, half-black and the Y program, and a
strain label for males (full red, Moscow, tuxedo, snakeskin, king cobra, mosaic, grass, lace, leopard, tiger, metal head,
Japan blue, pingu, maculatus, Endler-type and others).

**Sex-limited color:** `color.expression` is 1 for males and the female's leak share for females (`gp_female_leak`,
mostly under 0.4). A female carries her whole color program but shows a grey-olive fish with a faint tail tint. Her
sons show what she carries; the breeding prediction says so.

Ribbon fins: a ribbon male cannot sire (`health.canSire` is false), females can carry and pass it. Albino eyes draw
red; the iridophore hue palette avoids red so an amber eye never reads as albino.

### Development and livebearing

- Guppies are born as **live fry**, not eggs (`livebirthLife()`).
- Pairing a guppy female moves the clutch from courting to **gestating** with `gestation { matedDay, days }` (5–10 game
  days from `gp_gestation`). `matedDay` is counted in clutch days. The father is free again at once. A carried brood
  cannot be cancelled. At term the fry are born into the chosen nursery.
- A gravid female swells (`Maturity.gravid`, anatomy belly swell, gravid spot) as the brood grows.
- Young males stay grey until their color onset, then **color up over 8 game days** (`GUPPY_COLOR_UP_DAYS`): the tail
  and dorsal grow and expression rises from the leak to 1. Daughters stay grey.

### Anatomy and rendering

`guppyAnatomy.ts` builds a body-length-unit outline (snout at −0.5, peduncle at 0.3) with a caudal fan whose radius
depends on the tail shape. Swords are Gaussian spikes on the fan edge; one shear waves the whole fan. Dorsal flag,
dumbo pectorals, swallow and ribbon pelvics, the gonopodium (longer on ribbon males) and the gravid spot are all
geometry. `rendering/guppy.ts` draws every male color layer multiplied by expression. Picking, portraits, the Pixi
sprite cache and tank layout dispatch to it.

### Shop, names, market, shows, Atlas

- A guppy counter of five listings: domestic founders (◈ 170), strain males from 16 templates (◈ 220–400) and documented
  carriers of a recessive (◈ 250). Females show "carries … genes for her sons".
- Names come from an independent guppy vocabulary (`guppyNames.ts`, naming v1) gated by expressed adult traits. Atlas, Codex (34 guppy entries), rarity, market wants, show classes and the
  Genome view all handle `'guppy'`. The Genome view labels the sex chromosome's copies "X from mother", "Y from father".

## 3. Commissions

`src/core/commissions.ts` (model 1, world v20).

- **Posting.** Once a game week (`POST_EVERY_DAYS` = 7), the board fills to three offers (`MAX_OFFERS`). Each letter
  comes from one of eight fictional clients and asks for a species, a Codex entry the lab could reach at the current
  reputation, sometimes a sex, and a bred animal of at least some generation. Everything derives from the world seed,
  the letter number and the day, so the board replays exactly. Letters are posted only in **Genesis model 2** worlds;
  research harnesses and recorded journals are unchanged.
- **Terms.** Offers stay 10 days. Accepted letters have 24/36/54/80 days by tier. At most two are active.
  Rewards start at 220/380/620/980 by tier, raised by reputation level.
- **Delivery.** The animal must be in the lab, alive, adult, lab-bred, at least the asked generation, the asked sex,
  not courting or carrying a brood, and pass the Codex test. Delivery archives it as sold, pays a `commission` ledger
  entry and adds reputation (`10 × tier + 5 × (generation − 1)`).
- **Reputation.** Newcomer → Trusted breeder (30) → Renowned breeder (90) → Master breeder (200). Higher levels unlock
  harder tiers and a reward bonus. Declining an offer is free; withdrawing costs `4 × tier`; missing a deadline costs
  `6 × tier`.
- **Validation.** `accept-commission`, `decline-commission` and `deliver-commission` validate first and change nothing
  on rejection. `decodeSave` rejects a delivered letter whose animal is still living.
- **Desk UI** (`Commissions.tsx`, `commissions.css`, rail entry, G then M): envelopes with tier, reward and a deadline bar;
  the letter on paper with the Codex text and a terms checklist; Accept, Decline or Withdraw (with a confirmation);
  "Closest in your lab" portraits with ticked clauses and Deliver; breeding leads from a small deterministic sample
  (labelled as estimates); and a correspondence history.

## 4. What was verified

See [TESTING.md](../TESTING.md#guppies-and-commissions-world-v20). In short: 23 new tests (genetics, integration,
commissions), the full suite and build, and a browser journey on an isolated port from shop purchase to colored sons.

## 5. Known limits

- Balance (posting rate, rewards, deadlines, guppy prices, color-up time) is untuned.
- No sperm storage or repeat broods from one mating.
- Commission leads come from a small sample and are estimates, not odds.
- Commissions are local NPC letters, not other players.
