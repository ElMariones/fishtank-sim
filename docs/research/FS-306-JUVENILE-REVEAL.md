# FS-306 juvenile reveal and swim animation

**Recorded:** 14 September 2026 · **Status:** DONE, pushed `325ceb4`
**Models:** world save v4 (unchanged) · stage appearance v1 · genome v2 · development v4 · anatomy v2 · renderer v6

## Starting state

`b084eb5` (FS-305 marked DONE) was HEAD and `origin/main`, with no tracked changes. Only `.claude/launch.json` was untracked.

## Scope

FS-306 asks for a juvenile reveal and smooth body and fin animation, with the actual stage and the adult preview clearly distinguished. The renderer must keep consuming phenotype only, and saved genomes and lineage must not change.

## Model

**Stage appearance v1** (`src/core/juvenile.ts`) turns the adult phenotype and the saved life state into what a fish looks like today:

| Rule | Value |
|---|---|
| Body maturity | Smoothstep of current length ÷ (0.7 × adult length); 1 at the adult stage threshold |
| Pigment maturity | Smoothstep of age from game day 5 to 15 |
| Rounding | Both to twentieths, so a growing fish has few distinct stage phenotypes |
| Hatchling proportions | Head 1.35× (at most 0.5), eye 1.7×, depth 0.78×, snout 0.6×, tail 0.55×, spread 0.7×, dorsal 0.45×, pectoral 0.7×, barbel 0.3×, each easing to 1× with body maturity |
| Pigment | Red, black, metallic, fin pigment, speckle, motif and fin-motif strength, contrast and shimmer scale with pigment maturity; translucency starts at 0.5 or more; scale textures from 50% pigment |
| Unchanged | Genome, markings anchors, adult length, growth, longevity, metabolism, oxygen demand, fertility and every movement or behavior trait |

A fully mature fish returns the adult phenotype object itself, so stock, founders and migrated fish draw exactly as before. `rendering/stage.ts` caches stage phenotypes per adult phenotype and maturity, keeping the anatomy and ornament caches warm.

**Renderer v6** (`src/rendering/fish.ts`) adds optional swim motion. Portraits pass none and draw as renderer v5.

- **Tail:** beats at 3 + 5 × effort + 2 × activity radians per second × motion speed, and narrows its spread up to 14% mid-stroke.
- **Fins:** pectoral fins fold toward the body by up to 35% of their length, and the dorsal fin sways slightly.
- **Bounds:** motion never grows any structure, so anatomy bounds and portrait framing still hold.
- **Eggs:** `drawEgg` shows an egg with an embryo and eye spots appearing as incubation progresses.

**Tank** (`src/ui/TankCanvas.tsx`) interpolates positions and time across each 50 ms worker frame and eases facing through side-on at 4 per second, so a turn reads as the fish swinging round. Picking uses the painted pose and stage anatomy; nearly edge-on fish count as 35% wide. Incubating eggs rest as a cluster of up to 40 on the substrate. Steering still uses the adult phenotype's inherited movement, so drawing never changes behavior.

**Interface.** The large portrait has **Now** (**Last recorded** when archived) and **Adult potential** toggles with captions such as "NOW · FRY · 2.2 OF 65 CM" and "ADULT GENETIC POTENTIAL · A PREVIEW, NOT HOW THIS FISH LOOKS TODAY". Collection cards and pinned cohort parents share one device-local **Now / Adult potential** toggle, so comparisons use a single view. Relatives show the current stage; the breeding planner keeps adult previews because goals rank adult potential. **Visual fixtures → Juvenile reveal** raises one appearance fixture in healthy water on game days 0–30.

## Fixtures

`tests/juvenile.test.ts` (6 tests):

| Fixture | Result |
|---|---|
| Maturity | Eggs and day-3 hatchlings are 0/0; stock adults are 1/1 and return the same phenotype object; the adult stage threshold gives body 1; day 5 gives pigment 0 and day 15 gives 1; both rise monotonically over 60 healthy days |
| Interpolation | Hatchling ratios and halfway values match the declared proportions; pigment is 0 and translucency at least 0.5; 27 genetic, size, life-history and behavior values and the marking anchors are identical; the input is not mutated; the cache returns one object per maturity |
| Anatomy | Fixtures (founders, extremes, stress, appearance) and 600 founders at four maturities: no attachment failure, and no clipped silhouette point in fitted portraits |
| Ornament | No ornament before pigment; the adult ornament at full maturity; finite, bounded geometry and no more body alpha than the adult at half pigment |
| Turning | The default pose matches the old flip; a half-turned pose round-trips exactly; an edge-on fish stays finite and pickable at its centre |
| Reveal series | Egg on day 0, fry on day 3, a juvenile stage later, stages and body maturity never regress, pigment complete by day 16, no motifs on a hatchling |

Existing anatomy, picking, appearance and FS-101 fixture pins pass unchanged.

## Browser verification

In-app Chromium against the isolated `fishtank-qa` server on port 5176, continuing the FS-305 QA world:

- **Eggs:** breeding Haru × Sumi into the empty Breeding Studio gave the canvas label "0 swimming fish and 20 incubating eggs", egg portraits on the cards ("Fry 46, incubating egg, day 0 of 3") and the caption "NOW · EGG · HATCHES IN 3 GAME DAYS".
- **Growth:** after `savedAt` moved back 8 minutes, the reload restored 8 minutes without a save warning. The studio held 20 swimming fry, with cards such as "Fry 46, fry at 1.8 cm, current appearance · Fry · 1.8 of 65 cm".
- **Views:** the collection toggle switched every card label to "adult genetic potential", stored `portraits: "adult"`, and survived a reload. For Fry 46 the large portrait read "ADULT GENETIC POTENTIAL · A PREVIEW, NOT HOW THIS FISH LOOKS TODAY", then "NOW · FRY · 2.2 OF 65 CM" with **Now**.
- **Reveal fixture:** Visual fixtures showed renderer v6 and seven cards. Day 0 egg; day 3 fry at 0.6 cm; pigment 5%, 35% and 80% on days 6, 9 and 12; a juvenile with 100% pigment at 5.2 cm on day 16; a juvenile at 30.1 cm with 95% body maturity on day 30.
- **Phone, 375 × 812 with coarse pointer:** no document overflow. The **Now** toggle measured 43 × 44 px, so a coarse-pointer minimum width was added; the recheck measured 44 × 44 px.
- **Pixels:** all seven reveal portraits contain drawn pixels (read back from each canvas).
- **Console:** one "plural is not defined" error came from hot reload between two FS-305 edits and did not recur after reloads.
- **Not measured:** frame timing and screenshots. The browser pane was hidden, so animation frames did not run and screenshots came back blank.

## Limitations

- Fry steer with adult movement traits at their drawn size; stage-dependent swimming and behavior are not modeled.
- Pigment reveals by age only; poor care slows growth and proportions but not pigment.
- Turning is a horizontal squash of the 2D side view, not a rotation; tail sweep and fin flutter are stylized.
- Fitted portraits hide size differences; captions carry the length. The tank still draws size.
- No per-fish appearance version or archival portrait: every fish re-renders under the current stage and renderer model.
- Frame timing for a full tank under renderer v6 has not been measured on named hardware (FS-701).
