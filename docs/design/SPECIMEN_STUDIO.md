# Specimen Studio (FS-134)

9 November 2026, user request: "an inspect button that lets you inspect a single fish and isolate it in a view, view it
bigger, move it around, zoom… see in detail all its features, genome, commentaries, rating, price, family tree, awards."

The studio is a full-screen view that isolates one animal on a photographic stage, next to a dossier with everything
the lab knows about it. It is **read-only**: it never changes a fish, the world or the save. The only writes are the
existing favourite toggle and a device-local journal.

## Opening it

| Entry point | Result |
|---|---|
| **Inspect** button in the inspector heading | Studio for the selected animal |
| Magnifier overlay on the inspector's hero portrait, or a click on the portrait | Same |
| Double-click a fish in the tank | Selects it and opens the studio |
| `I` | Studio for the selected animal |
| Fish context menu → **Inspect in studio** (`I`) | Same; the old entry is now **Show profile** |
| Command palette → "Inspect *name* in the Specimen Studio" | Same |

Closing (Escape, ×, Back) returns focus to the last animal studied, which is selected in the tank.

## Layout

| Zone | Content |
|---|---|
| Header | Back, eyebrow (`SPECIMEN STUDIO · id`), name, species/variety/sex/generation chips, tank or archive, studio grade with stars, trail back, `n / N` stepper, favourite, Inspector, close |
| Stage (left) | Canvas stage with the HUD: life-stage panel (top left), lenses (top right), scale bar (bottom left), toolbar (bottom) |
| Compare row | "Compare at true scale" select (mother, father, siblings, offspring, tank mates of the species) and a "Study" link |
| Dossier (right) | Six tabs: Profile, Appraisal, Genome, Lineage, Honours, Journal |

Breakpoints: 1280 narrows the dossier, 1180 shows lens icons only, 1080 hides the grade badge, 900 stacks the stage
above the dossier and scrolls the whole panel, 650 is the phone layout (lens note hidden, zoom −/+ hidden because pinch
zooms and the percentage still resets, single-column facts and marks).

## Stage

- **True scale.** The silhouette is measured once per phenotype from a rest pose (`getImageData` bounding box), and the
  centimetres-per-pixel factor makes snout to tail tip equal the recorded `lengthCm`. The scale bar picks a 1–2–5
  length between 60 and 160 px.
- **Navigation.** Drag pans; wheel and pinch zoom about the pointer (50–800 %); double-click zooms in (Shift: out);
  `+` `-` `0`/`R` and arrow keys; the percentage button resets. A locator ring marks the animal when it is under 18 px.
- **Ruler** (`M` toggles the tool): drag between two points for a measurement in mm or cm on the same calibration. Escape clears it.
- **Life stage**: a scrubber from hatchling to adult with a "today" marker draws the phenotype the animal would show at
  that length (`currentPhenotype` with a synthetic length). Eggs show their potential.
- **Lenses** (`L` cycles): Daylight; Night (dimmed composite with a soft glow pass, so glow phenotypes read); Blueprint (silhouette,
  outline, cm grid and dimension lines for length and depth); Contrast (greyscale lightbox for pattern edges).
- **Freeze** (Space) stops the swim pose; **Flip** (`F`) mirrors the facing. Stage keys work while the stage has focus.
- **Compare**: a second animal at the same centimetre scale, stacked above and below with captions. A fry next to its
  62 cm mother is drawn as it really is: tiny.
- **Photo** exports a PNG of about 1600 px with a specimen plate band (name, species, sex, generation, id, studio mark,
  lens and zoom) as `name-id.png`.

## Dossier

- **Profile**: three curator notes (deterministic per id, from the record and its most distinctive tiers), record facts,
  temperament meters, features grouped by rarity tier (common traits folded away), and the rarity note.
- **Appraisal**: grade S–D, stars, verdict, a five-axis radar (form, pattern, condition, rarity, diversity) with the
  parents' average overlaid, per-axis meters with ▲/▼ against the parents, then market value with buyer offers and the
  terms behind them, and up to three open, licensed show prospects with projections.
- **Genome**: a karyogram of every locus in registry order, two stripes per cell (maternal, paternal) coloured by allele
  code, novel alleles in brass. Filters: All, Mixed (heterozygous), Matching, Mutations. Selecting a cell shows a locus
  card. Discovery mode hides alleles until the Atlas has sequenced them.
- **Lineage**: pedigree F, founders, generation and offspring; a top-down three-generation tree (grandparents, parents,
  animal); full siblings, half siblings and offspring as strips. Any node opens that animal in the studio.
- **Honours**: earned studio marks first, then locked ones with their condition, then the existing honours record.
- **Journal**: tags (Keeper, Breeder, Show prospect, For sale, Watch) and free notes, saved automatically, plus the
  judges' commentary from every finished show the animal entered.

`[` and `]` (or PageUp/PageDown) step through the tank (or the archive for animals no longer living); the trail
button returns along the animals opened from inside the studio. Arrow keys move between dossier tabs.

## Honesty rules

- **Grade is not price.** The appraisal note says so beside the radar. Price comes from `offersFor`, the same buyers
  the market uses.
- **Grade is not a judge's score.** It reuses `competitionScores` under a neutral event id (`studio-bench:species`), so
  no show brief or incident affects it.
- **Rarity, diversity and inbreeding stay separate.** Rarity is the share of founder offspring with the trait tier;
  diversity combines locus heterozygosity and pedigree F; a "Close kin" warning mark appears at F ≥ 0.125.
- Calibration on 51 founders and F1 koi at full condition: median overall 63, quartiles 59–66; grades A 5, B 39, C 7.
  S needs 82.

## Code

| File | Holds |
|---|---|
| `src/core/specimen.ts` | Pure domain: appraisal, show prospects, studio marks, curator notes, karyotype, pedigree rows, siblings, journal codec, stage maths |
| `src/ui/specimen/SpecimenStage.tsx` | Canvas stage, lenses, measuring, interaction, photo export |
| `src/ui/specimen/SpecimenStudio.tsx` | Modal shell, header, compare, six dossier tabs, journal |
| `src/ui/specimen/specimen.css` | Styles on the Deepwater tokens (canvas drawing and the exported plate use literal colours) |
| `tests/specimen.test.ts` | Eight domain tests |
