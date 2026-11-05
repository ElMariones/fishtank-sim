# Genome Editor: the Splice Bench (FS-132)

Design spec produced with `/design` (design-superpowers). Maturity: **L1**. The Deepwater design system
([DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), `src/ui/design/tokens.css`) is the design language; no Figma library exists, so
every decision below composes Deepwater tokens and kit components. Nothing is drawn from a third-party game.

## 1. Need

> "Operate and modify the fishes' DNA: extract genome parts with clickable minigames, save them, and add them to another
> animal so its offspring carry them."

Abstracted interaction primitives: **select a specimen → select a locus → perform a skill task → store an item →
apply the item to another specimen → see the inherited consequence.** It is a crafting loop (harvest → inventory →
apply) laid over the existing genome view.

## 2. Domain decisions (what an edit is)

| Question | Decision | Why |
|---|---|---|
| What is extracted? | A **gene cassette**: one allele copy (species, locus, allele ID) from one homolog of a living donor. An open-ended (named) allele carries its definition; an allele descended from a recorded mutation carries its origin ID. | Loci and alleles are already the stable unit of the model (stable locus order, phased copies). |
| Does extraction harm the donor? | No. It is a biopsy: the donor's genome is unchanged. | Fish never die; identity and genomes are immutable (AGENTS.md). |
| What does a splice change? | The recipient's **germline**: a per-fish edit `(locus, copy) → allele` stored in `world.geneLab.edits`. Every later birth reads the parent's genome through its edits. The recipient's own genome record, phenotype and look do not change. | Keeps the immutable-genome and replay contracts. It is also what the user asked: "making its offspring carry it". The UI says it plainly. |
| How many offspring carry it? | One edited copy: about half (each child gets one homolog per locus, crossovers apply). Both copies: every child. | Real Mendelian consequence, no new randomness. |
| Lineage | A cassette from a mutation-descended allele keeps its origin, so the child still shows ◆ and the Mutation notebook follows the allele across lineages. Edited positions without an origin drop the parent's old origin at that copy. | `originProblem` requires the carried allele to match its origin. |
| What cannot be edited? | The guppy sex locus (sex must stay genetic). Loci the recipient's genome version does not carry. A named allele into a non-Genesis genome. A copy that already carries that allele. Eggs. | Each would break a save contract or mean nothing. |
| Cost | Extraction ◈ 25, splice ◈ 40 per copy, ledger reason `research`. Failed minigames cost nothing. | Value actions use brass; existing `research` ledger reason, no ledger shape change. |
| Limits | 12 cassettes in the vault; 6 edited positions per animal; 1,200 edit records per world. | Bounded state, like every other world collection. |
| Discovery mode | Locus names follow the Atlas stage; allele IDs of unsequenced donors stay `??` (an **unread cassette**). Splicing still works; the offspring reveal what it was. | Honest to the Atlas; mystery cassettes are part of the fun. |
| Body-plan genes | An edited parent's latent body-plan genes are pinned to its unedited genome. | An edit must not shift unrelated module genes through the genome fingerprint. |

## 3. Minigames (the skill layer)

All three are client-side skill checks. The domain only receives the resulting score (`integrity` or `fidelity`, an
integer 0–100) inside the command, so replay is exact. Each has pointer and keyboard controls, an always-visible goal,
and a reduced-motion variant (slower speeds, no shake).

| # | Name | Where | Mechanic | Score → effect |
|---|---|---|---|---|
| 1 | **Restriction Cut** | Extract | A DNA ladder scrolls under the enzyme scissors. Two recognition sites (5′ and 3′) flank the gene. Press **Cut** (Space) as each site crosses the cut window. Cutting bare strand nicks it (−15, three nicks shred the sample); a missed site loops back faster (−8). | Integrity = mean accuracy − penalties. ≥ 30 to keep. Integrity sets **doses**: 1 (<60), 2 (60–84), 3 (≥85). |
| 2 | **Sticky Ends** | Splice, step 1 | The cassette's single-stranded overhang shows 6–9 bases; pair each with its complement (A↔T, G↔C) via four nucleotide pads or the A/T/G/C keys before the timer runs out. Three mismatches unravel the end. Low-integrity cassettes have longer overhangs. | Pairing score = accuracy × time bonus. |
| 3 | **Anneal** | Splice, step 2 | A thermocycler dial sweeps; lock the needle inside the annealing window three times as it narrows and speeds up. Window width scales with cassette integrity. | Anneal score = mean closeness. Fidelity = mean of steps 2–3; ≥ 40 to land. |

Both copies need fidelity ≥ 70; below that the result screen offers to land the edit on one copy instead.

## 4. Layout proposal (Layout Composer)

**Pattern:** list-detail workbench (three columns). **Grid:** `minmax(250px, 300px) | 1fr | minmax(280px, 340px)`,
gap `--s-5`. **Density:** default.

| Zone | Content | Deepwater pieces |
|---|---|---|
| Heading | Kicker "THE SPLICE BENCH", title, one-paragraph honest explainer, mode segmented control **Extract / Splice**, vault meter | `.segmented`, display type, `--gene` tone |
| Left: specimens | Species chips, search, list of living animals (mini portrait, name, sex, edited badge) | chips, `FishPortrait`, list rows like collection cards |
| Centre: workbench | Large portrait plate; **karyogram** of 12 chromosomes, each a pair of homolog bars (maternal top, paternal bottom) with six clickable locus bands; selected-locus card with both copies and the primary action | new `.karyo` composition on `--gene`, `LocusTip` style notes |
| Right: vault | Cassette cards (custom cassette art, locus, allele, donor, integrity meter, dose pips, rename/discard), then the selected animal's germline edits with **Restore** | cards, `Dialog` for discard, `--gene`/`--brass` |
| Overlays | Minigame `Dialog` (tone gene) with intro → play → result | `Dialog`, `ToastStack` notices via `run` |

### Responsive behaviour

| Breakpoint | Change |
|---|---|
| ≤ 1280 px | Vault drops below the workbench (two columns). |
| ≤ 900 px | One column: specimens become a horizontal scroller. |
| ≤ 650 px | Karyogram bands shrink to codes only; minigames fill the viewport. |

### Heuristic findings

| Heuristic | Finding | Severity | Adjustment |
|---|---|---|---|
| Visibility of status | Player must know whether an edit "worked" when the fish looks the same. | P1 | Germline edit list on the recipient, a ✂ marker on edited bands, edited badge in lists, and an inheritance note ("about half of its offspring" / "every offspring"). |
| Match real world | "Cassette", "restriction site", "sticky end", "anneal" map to real cloning steps; copy explains each in one line. | — | Plain-language subtitle under every game. |
| Error prevention | Incompatible loci, full vault, low credits, eggs. | P1 | Compatible bands glow; the action button explains why it is unavailable instead of silently disabling (Deepwater convention). |
| User control | Leaving a minigame. | P2 | Escape / Abandon always available; nothing is charged until a result is committed. |
| Recognition over recall | Which cassette fits which animal. | P2 | Picking a cassette filters specimens to its species and highlights its locus. |
| Accessibility | Timing games exclude some players. | P2 | Keyboard controls, `prefers-reduced-motion` slows speeds, scores are lenient (≥ 30 / ≥ 40 pass). |

## 5. Pattern match

| Need | Result | Source |
|---|---|---|
| Animal list with portrait | Near match: Commissions candidate rows | `commissions.css` |
| Genome display | Near match: inspector chromosome rows; the karyogram is a denser, clickable variant | `inspector.css` |
| Confirmation and games | Exact: `Dialog` with tone | kit |
| Inventory card | No match: new cassette card composed from tokens | this spec |

## 6. Gap report (Gap Detector)

**Type:** new view-local compositions (no new kit component). **Affected area:** Genome Editor only.
New custom glyphs added to the Deepwater icon set: `splice`, `scissors`, `cassette`, `vault`, `helix`, `thermo-dial`
(drawn on the 24 px / 1.75 stroke grid). Minigame art is inline SVG using tokens. If a second screen needs cassette
cards, promote them to `src/ui/kit`.

## 7. Contracts

- World v21 appends `geneLab: { model: 1, nextCassette, cassettes, edits }`. Older saves migrate with an empty lab.
- Commands: `extract-gene`, `splice-gene`, `discard-cassette`, `label-cassette`, `restore-germline`. Atomic; rejected
  commands change nothing.
- Every birth path reads parents through `germlineFish` (`breeding.ts` spawn and the instant `breed`). Planner
  predictions read the same, so previews stay honest.
