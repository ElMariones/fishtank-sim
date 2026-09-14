# FS-404 bounded family graph

**Recorded:** 14 September 2026 · **Status:** DONE, pushed `b7c3e37`
**Models:** world save v5 (unchanged) · genome v2 · no save, command or kinship change

## Starting state

`f944706` (FS-401/402 marked DONE) was HEAD and `origin/main`, with no tracked changes. Only `.claude/launch.json` was untracked.

## Scope

FS-404 asks for a bounded ancestor graph with portraits, cross-tank and archived focus, and six-generation navigation. The UX specification (section 6) adds:
- one identity for a repeated ancestor;
- progressive depth and paginated descendants;
- breadcrumb history and a way back to the starting fish;
- search by ID or name;
- visible assumptions and missing ancestors.

## Model

`src/core/genealogy.ts` is pure and reads only parent IDs.

**Index.** One pass builds records by ID and children by parent, in ID order. The app builds it only while the Family tab is open.

**Ancestors.** `ancestorGraph(index, focus, depth)` clamps the depth to 1–6 and walks back one generation at a time.
- **No expansion:** it carries how many pedigree positions each fish fills instead of expanding all 2^n positions.
- **One node per ancestor:** an ancestor reached by several paths is listed once, at its nearest generation. It records its position count, every generation it appears in, and each fish in view that names it as mother or father.
- **Per-generation counts:** recorded positions, positions above founder stock (unknown) and positions whose recorded parent has no record in the world (missing). The three always sum to 2^n.
- **Bounds:** a view holds at most 126 distinct ancestors. A node whose recorded parent lies outside the view is marked to continue, and the graph reports whether one more generation would show anyone.

**Descendants.** `descendantGenerations` walks forward up to six generations. Each descendant is listed once at its nearest generation, and the walk counts sixth-generation descendants that have offspring beyond the view.

**Search and trail.**
- `findRecords` ranks an exact ID (digits such as "47" also work), then an exact name, a name prefix, and any other name or ID match. It returns up to eight results with the total.
- `visitTrail` appends the fish being left, returns to an earlier step instead of looping, and keeps 12 steps.

**Interface.** `src/ui/FamilyView.tsx` replaces the one-hop Parents and Offspring lists.
- **Ancestors:** generations are named from Parents to 4× great-grandparents. Parents and grandparents show by default, and **Show …** adds one generation at a time up to six. The depth is kept while moving between relatives.
- **Each row:** a current-stage portrait, name, generation, sex, aquarium or "Sold · archived record", and "Mother of …" or "Father of …". Notes mark repeated positions, "Founder stock" and "Earlier ancestors recorded".
- **Missing ancestors:** each generation heading counts recorded positions and those above founder stock or missing. Trailing generations with nothing recorded collapse into one note. The closing note states that pedigree F uses every recorded generation and assumes unrelated, non-inbred founder stock.
- **Descendants:** one button per generation forward with counts, listing each relative's parents, 60 per page.
- **Navigation and search:** a relative or search result is selected through the existing selection path. A living fish brings its aquarium into view and the inspector heading takes focus; a sold fish opens its archived record. The breadcrumb trail offers **Back**, **Return to** the first fish and clickable earlier steps, and any selection outside the family view starts a new trail.
- **Shared controls:** `SexMark` and `Pagination` moved from `App.tsx` to `src/ui/Controls.tsx` so both views share them.

Pedigree F still comes from `pedigree.ts` over every recorded generation. Saves, commands and replay are unchanged.

## Fixtures

`tests/genealogy.test.ts` (8 tests):

| Fixture | Result |
|---|---|
| Repeated ancestors | A fish from half-siblings lists their shared sire once, in 2 positions, with both child edges. Its backcross to that sire lists him once at generation 1 in 3 positions (generations 1 and 3), with unknown positions doubling above him. Both match the reference |
| Reference pedigree | A 400-record inbred pedigree (parents drawn from the latest ten of each sex), with three records removed. For every remaining fish at six generations, and at 120 random depths, the graph matches an explicit position-by-position expansion: recorded, unknown and missing counts, listing order, repeats, positions, generations, edges and continuation. Repeats, missing positions and continuation all occur |
| Ten generations | In a sibling-mated line, generation 10 shows six generations with 2^n recorded positions each. The view ends at the generation 4 pair, marked to continue; focusing one reaches the founders, with 32 and 64 unknown positions beyond. A founder's descendants are six generations of two, with two continuing |
| Sold and cross-tank | Built with real commands: a lab cross into Breeding Studio, then the mother moved there and the father sold. The egg's graph lists both parents with their tank and sold status, and is identical with records reversed. The father's descendants are the 20 eggs in ID order |
| Nearest-generation descendants | After a father–daughter backcross, the grandson is listed as the sire's child, not again as a grandchild. A one-generation limit reports one descendant continuing |
| 10,000 records | Building the index, 50 six-generation ancestor graphs and one six-generation descendant walk take under 500 ms together. Every view holds at most 126 ancestors with counts summing to 2^n, and descendants are unique |
| Search | "2" finds sold Sumi; full IDs, case-insensitive names and prefixes rank as declared; a blank query finds nothing; 11 matches return eight with the total |
| Trail | Returning to an earlier fish truncates the trail there, revisiting the current fish changes nothing, and 40 steps keep the last 12 |

## Browser verification

In-app Chromium, with the `fishtank-qa` server on port 5176 reached from two isolated origins.

**Continuing QA world (`http://localhost:5176`, world v5):**
- **Founder:** Haru's Family read "Founder stock · no recorded parents", "60 within 1 generation" and **Children · 60**. Each child row named its aquarium: The Koi Garden or Breeding Studio.
- **Cross-tank focus:**
  - Selecting Fry 31 moved focus to its name heading and brought Breeding Studio into view. The trail read "Haru › Fry 31" with **← Back to Haru**.
  - Parents read "2 of 2 positions recorded": Haru ("The Koi Garden · Mother of Fry 31 · Founder stock") and Sumi, followed by "No ancestors are recorded beyond the parents. Those lines begin with founder stock."
  - Selecting Haru from that list returned to The Koi Garden and cleared the trail instead of adding a loop.
- **Archived focus:**
  - Selling Sumi gave "Sumi sold. The archived profile remains in the family tree.", with the archive note and no owner actions.
  - Back on Fry 31, Sumi's row read "Sold · archived record". Selecting her kept Breeding Studio in view and showed **Last recorded** ("LAST RECORDED · ADULT · 66 OF 66 CM"), her 60 children, and the trail "Haru › Fry 31 › Sumi" with **Back** and **Return to Haru**.

**Generated deep lineage (`http://127.0.0.1:5176`):**
- **Setup:** a page script ran the real commands: nine lab-cross generations, 4 game days apart. Each generation kept a sibling pair and sold the rest; founder Sumi was sold after generation 2 and Yuna (generation 4) after generation 6, and generation 5 was a backcross to Kai (generation 3).
- **Import:** the runtime JSON (133,367 characters) went into **Saves** → **Validate import**, whose preview read "186 records · 40 living · 2 tanks", and was committed with **Replace world with reviewed import**.
- **Search:** typing "Tomo" returned one result, "Tomo G9 · ♀ Female · Breeding Studio FSH-000167"; selecting it focused Tomo in Breeding Studio.
- **Six generations of ancestors:**
  - **Positions:** 126 of 126 recorded, 13 distinct ancestors with portraits, pedigree F 82.0%.
  - **Repeated ancestor:** Kai is listed once among the 3× great-grandparents: "Father of Emi, Taro and 1 more · In 32 positions · among 3× great-grandparents and 4× great-grandparents". The next generation adds "Also here, listed nearer: Kai."
  - **Archived and continuing lines:** Yuna reads "Sold · archived record". Hana and Sora read "Earlier ancestors recorded", with "Six generations is the most shown at once…".
  - **Collapsing the view:** only **Show only parents and grandparents** remained.
- **Continuing back:** selecting Hana brought The Koi Garden into view with the trail "Haru › Tomo › Hana".
  - Her ancestors end at founders Haru and Sumi (sold), each "In 2 positions", followed by "No ancestors are recorded beyond the grandparents…".
  - Her descendants run 20/40/20/20/20/20 over six generations. **Grandchildren · 40** listed 40 rows, from "Riku · Offspring of Mei × Kai" to a sold "Fry 106 · Offspring of Yuna × Kai".

**Phone, 375 × 812 with coarse pointer:**
- Haru's Family (62 controls) had no document overflow and nothing under 44 px.
- With a trail, the "Haru" breadcrumb measured 43 × 44. A coarse-pointer minimum width fixed it to 44 × 44 before commit.

**Keyboard and console:**
- Shift+Tab from the search field reached **← Back to Haru**, then the inspector tabs.
- Enter and Space sent through the browser tool did not activate a focused button, including the existing **Genome** tab. The tool could therefore not exercise keyboard activation. The new controls are native buttons with no key handlers.
- No console errors on either origin.

## Limitations

- Generations are lists with text edges; there is no drawn pedigree chart for wide screens.
- The breadcrumb trail and chosen depth are session state: they are not saved and reset on reload.
- Pedigree F is still computed on demand without a cache (FS-405).
- Search is substring matching over names and IDs, eight results at a time, with no fuzzy matching.
- Portraits show the current or last recorded stage; there are no historical portraits or per-record renderer versions (FS-601).
- A six-generation view of an outbred line draws up to 126 portraits; this was not profiled on low-end devices.
- Batch actions on a cohort remain FS-406.
