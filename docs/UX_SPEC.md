# Product flows and interface specification

**Purpose:** continuation-ready UX requirements for the solo game. Refer to [implementation status](IMPLEMENTATION_STATUS.md) before assuming any screen exists.

## 1. Information architecture

The research prototype is one working screen: aquarium selector, live tank, breeder, fish collection, and inspector. Planned product surfaces are Aquarium, Breeding, Lineages, Market, and Settings. Use deep-linkable fish and tank IDs when navigation is extracted; route names below are proposed.

```text
/aquariums/:tankId         Aquarium workspace and care controls
/fish/:fishId              Shareable/readable inspector context
/breeding/:clutchId        Parents, cohort progress and reserved nursery
/lineages/:lineageId       Registered standard, founder and descendants
/market                   NPC shop, later trusted listings
/settings                 Time/offline mode, audio, accessibility, save/recovery
```

Opening a fish from a market or family tree must preserve a back-navigation origin. A route should never move the fish.

## 2. Desktop workspace

```text
┌ Brand / world / save state ─────────────── Currency / settings ┐
│ Tank list │ Tank name and actionable care summary │ Inspector │
│           │                                       │ Portrait  │
│ Display   │          LIVE AQUARIUM                 │ Name      │
│ Nursery   │                                       │ Tabs      │
│ Line A    │ Pause / speed / feed / view tools      │ Facts     │
│           │                                       │ Actions   │
│ Add tank  │ Breeding or care panel                 │           │
│           │ Filterable fish/cohort collection      │           │
└───────────┴───────────────────────────────────────┴───────────┘
```

The aquarium remains the main visual subject. No marketing hero, feature carousel, or generic dashboard KPI wall before the fish. Large data views open when requested, not permanently over the tank.

### Responsive behavior

Desktop: persistent tank navigation, tank, inspector. Tablet: horizontal tank selector and optional inspector pane. Phone: tank first, inspector as a dedicated view or bottom sheet with a clear return action; the lab currently stacks the inspector below the collection.

Minimum target 360 CSS pixels. Essential controls support 200% text enlargement. Fish also have list buttons, so selecting a moving silhouette is never the only path. Reduced motion starts paused in the current lab.

## 3. Select and inspect

**Trigger:** click a visible fish, use a collection button, choose a search result, or open a family node.

**Result:** one selected ID; subtle visible highlight; inspector reads exactly that fish; current tank changes only if the selected fish is living and locally owned in another tank. Preserve scroll/focus context where practical.

**Overview fields:** name, sex, birth, life stage, current size, mature potential range, generation, tank/ownership status, health/stress trend, value estimate, mutations, pedigree F and measured heterozygosity.

**Lab implementation (FS-306):** the large portrait has **Now** (**Last recorded** for archived fish) and **Adult potential** toggles, with a caption such as "NOW · JUVENILE · 21 OF 61 CM" or "ADULT GENETIC POTENTIAL · A PREVIEW, NOT HOW THIS FISH LOOKS TODAY". Eggs draw as eggs. Collection cards and pinned cohort parents share one **Now / Adult potential** toggle kept on the device, so a comparison always uses one view; relatives show the current stage. The tank draws the current stage and an egg cluster on the substrate.

**Rename:** draft edit, validation 1–32 trimmed characters, explicit save or clear keyboard submission, success feedback. The name is ordinary text, never HTML. Immutable ID remains visible independently.

**Empty:** “Select a fish to inspect.” **Archived:** read-only facts and family links with status. **Unavailable/private:** retain the ID/relationship tombstone and explain access limits.

## 4. Genome view

Show chromosomes in stable map order. Two aligned homolog copies per locus. Allele cells expose: stable ID, trait interpretation, dominance rule, source parent, de novo mutation, inherited mutation origin, and known/unknown status.

Do not imply that larger allele IDs are better. Use text/icons for mutation and carrier status; color is supplementary. Give an “Explain this trait” action that identifies interacting loci and environmental factors.

Filters: changed from parents, carriers, new mutations, selected trait contributors. Full export uses a versioned structured format, not an image of a chromosome list.

The current lab shows all 48 loci and marks new mutations with an asterisk. Carrier explanations are textual; interactive trait tracing is planned.

## 5. Breed and compare

1. Choose a female and a male from eligible owned fish.
2. Select the nursery and tracked offspring count.
3. Inspect compatibility, expected F, capacity/cost reservation and predicted trait ranges.
4. Confirm the cross. Feedback names both parents, nursery and reserved count.
5. Courtship status shows reasons and conditions. Cancellable states explain any refund/reservation release.
6. Hatch/reveal notifications link to the cohort. One notification summarizes the clutch; do not fire one toast per fish.
7. Compare siblings, keep candidates, move/rehome surplus, then select the next parents.

**Comparison layout:** pinned parents above a offspring grid; selectable descriptor sort; a few measured traits beside each portrait; name/ID and sex; favorite action; selected count. Keep the same portrait framing/age preview for fair comparisons.

**Lab implementation (FS-104):** a breeding goal (any visible descriptor, higher or lower) persists on the device. It ranks the collection, shows each fish's goal value on its card, in the parent pickers and in the inspector, and offers one goal leader per sex that sets a parent without clearing the goal. Cards have a ☆ favorite toggle and the collection has a Favorites filter. A Parents filter narrows the view to the offspring of one parent pair (all of that pair's clutches) and pins both parents above the grid with their goal values. Breeding switches the view to that pair's offspring. Goal values are normalized adult genetic potential, not current size, and leaders are a convenience for the declared goal rather than a universal best match.

**Blocked cases:** same fish; wrong reproductive role; underage; archived/listed parent; unhealthy/unready parent; different breeding habitat; nursery full; pending clutch cap; stale world version. Messages say what can change.

**Implemented probability language (FS-403):** “256 independent samples” with linkage and 0.3% mutation per copy, versus exact single-locus genotype odds before mutation. Show median and 10th–90th percentiles, explain they are empirical ranges rather than confidence intervals, and distinguish normalized expression scores from inheritance probabilities. Exact allele IDs are available for all 60 loci. Normal breeding/courtship/nursery flows remain planned. Never imply a committed clutch will contain exactly the predicted percentage.

**Lab implementation (FS-401/402):** the breeding panel defaults to **Normal breeding**, with **Instant lab cross** as a labeled research shortcut. Both modes share the parent pickers, goals and predictions.
- **Setup:** normal breeding adds a nursery select showing free places and a tracked-egg count (8–24).
- **Blockers:** every hard blocker is listed with its fix. When none remain, a ready line names the courtship tank, the expected game days and the places that will be reserved. A second list warns if courtship would pause right now.
- **Commit:** **Start courtship · reserve N places** commits the pairing.
- **Clutches list:** courting clutches show a progress bar, game days, reserved places, live pause reasons and **Cancel courtship**. Incubating and recently hatched clutches offer **Show clutch**, which opens the nursery filtered to that pair.
- **Elsewhere:** the inspector adds a **Breeding** row (ready, not yet adult, resting, condition too low, or courting with progress). The return summary lists eggs laid and paused courtships.

## 6. Family navigation

Tree is a directed ancestry graph. Repeated ancestors share identity rather than becoming unrelated duplicate records.

Default shows parents and children with portraits, then expandable grandparents/ancestors. Load a bounded depth and paginate broad descendant sets. Support breadcrumb history, back-to-focus, and a search-by-ID/name action.

**Critical journey:** select Ember in nursery → Family → Haru in display tank → inspector switches to Haru and display tank highlights her → select Ember’s descendant → correct tank and record.

**Archived journey:** sell Haru → open Ember’s Family → Haru still appears with sold badge → clicking shows preserved genome and historical portrait → no owner actions available.

Deep pedigree should expose coefficient assumptions and missing ancestors. Do not render a massive 50-generation graph at once. Navigate progressively.

**Lab implementation (FS-404):** the Family tab lists ancestors by generation: Parents, Grandparents, Great-grandparents, then 2×–4× great-grandparents. Parents and grandparents show by default; each **Show …** press adds one generation up to six, and that depth is kept while moving between relatives.
- **Ancestors:** each appears once, at its nearest generation, with a current-stage portrait, name, generation, sex, aquarium or "Sold · archived record", and "Mother of …" or "Father of …". A repeated ancestor states how many positions it fills and in which generations, and a later generation that meets it again says "Also here, listed nearer". Founders say "Founder stock"; ancestors whose parents lie beyond the sixth generation say "Earlier ancestors recorded".
- **Missing ancestors:** each generation heading counts recorded positions and those above founder stock or missing from the world. Generations with nothing recorded collapse into one note. A closing note says pedigree F uses every recorded generation and assumes founder stock is unrelated and not inbred.
- **Descendants:** one button per generation forward, up to six, with counts. The chosen generation lists each relative with its parents, 60 per page, and notes when the sixth generation has offspring of its own.
- **Navigation:** selecting a relative or search result focuses it. A living fish brings its aquarium into view and the inspector heading takes focus; a sold fish opens its archived record. A session-only breadcrumb trail of up to 12 steps offers **Back**, **Return to** the first fish and clickable earlier steps; revisiting a fish on the trail returns there instead of looping. Selecting a fish outside the family view starts a new trail.
- **Search:** **Find any record** matches names and IDs (digits such as "47" work) across living and sold fish, eight at a time.

**Lab implementation (FS-405):** in normal breeding, expected pedigree F reads "from recorded ancestry; the N founders behind this pair are assumed unrelated and not inbred". The Family view's closing note likewise says how many founders in the fish's recorded ancestry its F assumes. Values come from a session kinship cache and match the uncached calculation exactly.

## 7. Tanks, care and transfer

Tank selector shows name, role, stocking warning and unresolved urgent issues. Opening a tank does not reset physiology.

**Feed:** portion slider or presets; preview cost and food load; choose position if meaningful; fish react; uneaten food is visible and later affects water. The lab’s eight-second food target is only a behavior demonstration.

**Care:** concise trend and source. “Oxygen low; 7 fish affected” links to aeration, stock transfer or feeding reduction. Avoid scientific-looking precision unsupported by the model.

**Lab implementation (FS-305):** above the live tank, chips show oxygen, ammonia, stocking, the fed share of the last game day and water temperature (with the thermostat target while it moves). Warnings list the problem, the number of fish affected and fixes with their cost; a fix opens **Care controls** with the change pre-selected rather than applying it. Care controls hold feeder ration, filter, aeration and thermostat selects, a table comparing now, three game days with the current settings and three game days with the chosen settings, the equipment cost, and **Apply settings**. Water change buttons (10/25/50%) preview the immediate ammonia and oxygen change before **Change N%**. **＋ Feed** adds a real portion as well as the visual pellets. The inspector's Condition row names every limiting cause.

**Transfer:** select fish → destination → compare capacity/environment → submit → one transactional result → offer navigation to destination. Keep source and destination fish counts consistent. Failure leaves all fish in the source.

**Decorate:** inventory/price list, object preview, drag/rotate, clear functional footprint, placement validation, apply/cancel, undo for local placement. Plants should not cover essential fish-selection controls.

## 8. Buy and sell

NPC shop is clearly labeled in solo play. A marketplace listing shows the actual reproducible specimen, stage, health, known genetics, provenance, price and receiving tank.

Before selling, show fish name, price, destination type and irreversibility within the game; indicate that lineage history remains. Batch sale/rehome reviews count and selected names. After sale, focus can remain on the archived record.

**Lab implementation (FS-109):** residents have a select checkbox; shift-click selects a range; "Select all" and "Clear" act on the visible collection. A review lists each selected name, ID, generation and quote plus the total before one atomic `sell-batch` command. Switching tank or archive view clears the selection. Batch rehoming arrived with FS-406 (below). Sex is shown as a larger pink ♀ or blue ♂ with a text label or hidden text, so colour is never the only cue (FS-108). All / Females / Males buttons with counts filter both the resident and archive views; changing the filter clears the batch selection so a sale never includes hidden fish (FS-110).

**Lab implementation (FS-406):**
- **Clutch filter:** when the chosen parent pair has more than one clutch, a **Clutch** filter (listed by ID range and size) narrows the view to fish laid together. A lab cross and **Show clutch** open that clutch directly.
- **Selection:** any living fish in view can be selected, and cards say when a selected favorite or egg is kept from sales. **Select all N** (with "in this clutch" when filtered) and **Select all saleable N** fill the selection.
- **Move review:** **Review move of N** opens a review naming the source and destination, with a destination select showing free places. It states the destination's free places, reservations and places left, warns when a courting fish would leave its partner, and lists every selected fish with ID, generation and stage. **Confirm move of N** sends one `move-batch` command; afterwards **Open** navigates to the destination.
- **Sale review:** lists only saleable fish and says how many selected favorites or eggs stay.
- **Research:** **Two generations** runs the seeded M4 demonstration and shows its clutches, timeline, instant-cross count, rehomed fish and replay result.

**Lab implementation (FS-501):**
- **Offers:** the inspector shows **Best NPC offer** with the buyer and price. **Why ◈ N from the …** lists the base price, trait interest, bred-here bonus, stage, condition, demand and any limit, followed by other buyers' offers.
- **One fish:** **Sell to {buyer} · ◈ N** confirms the buyer and price. Without an interested buyer the button reads **No buyer today**. **Rehome · no credits** confirms that the fish leaves the aquarium without payment and stays in the archive.
- **Batches:** the batch bar counts selected fish with offers and their total.
  - The sale review lists each fish's buyer and price in selling order, since later sales to one buyer pay less, and says how many favorites, eggs or unwanted fish stay.
  - **Review rehoming of N** lists the hatched fish that are not courting.
- **Buyers and ledger:** the credits in the header open **Buyers and ledger**, showing what each buyer wants, how many more fish it will take, its daily recovery and budget. It also shows the opening balance, totals by reason, the balance and the latest entries.
- **Archive:** sold and rehomed fish share the archive, labeled by how they left.
- **Research:** **Economy experiment** runs the six E-05 strategies.

For online fixed-price purchase, show pending state, then one authoritative receipt. If a listing changes or another buyer wins, refresh the specific listing and explain. Never optimistically create a tradeable fish before server confirmation.

## 9. Named lines and notebook

Registration flow: select founder(s), name the line, define target descriptors, preview ancestry rules, register. Profile separates founder contribution from measured standard resemblance and stable transmission rate.

Notebook keeps player notes, favorite crosses, observed mutations and experiment outcomes. Notes are editable and local/private by default; public lineage metadata is separate.

## 10. Error and recovery matrix

| Situation | Player-facing behavior | Data behavior |
|---|---|---|
| First run | Starter tank immediately available | Create one world once |
| Empty tank | Explain move/stock actions | No implicit fish generation |
| Invalid name | Inline explanation, draft preserved | No record change |
| Full nursery | Show missing slots and destination choice | No partial clutch |
| Save unavailable | Persistent warning + export | Keep memory session; never claim saved |
| Corrupt/future save | Preserve original; offer recovery/import choices | No automatic overwrite |
| Worker crash | Pause and show recovery action | Load latest valid checkpoint |
| Offline cap reached | Summarize protected period and remaining elapsed time | Never silently apply unlimited time |
| Private ancestor | Minimal relationship tombstone | Do not expose private owner/genome |
| Listing race | Explain no longer available | No debit or partial transfer |
| Browser visibility change | Pause visual work; lifecycle follows documented mode | No genetics reroll |

### Implemented return summary (FS-307)

After protected offline catch-up of at least one game day, a **While you were away** panel sits above the tank. It states how many game days passed and whether the eight-hour cap was reached. Each tank with something to report gets a row: fish count, eggs hatched, fish that became juvenile or adult, mean condition before and after, how many declined, the causes that limited condition with their day counts, what needs attention now, and an **Open** button for that tank. Quiet tanks are counted in one line. The panel closes with a statement that every decline had a named cause, or asks the player to export and report the save if one did not. **Dismiss** removes it; the live status line only points to it, so the notice is not announced twice.

### Implemented saves panel (FS-203/204)

The save status is visible above the workspace on desktop and mobile. **Saves** offers export, preserved legacy export, retry, two backup previews and file/paste import. Imports validate completely before showing record/living/tank/credit counts and an explicit **Replace world with reviewed import** action. The current valid save rotates into backups. Invalid or future data is rejected without replacing the current world; unreadable stored data blocks automatic writes and is preserved during explicit recovery. Preferences remain device-local, stated beside the export controls.

Large collection and offspring lists paginate at 60 rows (FS-112). Filters/search cover the full matching population; all residents of one tank fit on a single page. Pedigree F retains exact recorded ancestry without an age/depth cutoff.

## 11. Acceptance journeys

- Keyboard-only: select, rename, choose parents, breed, inspect child, follow parent, transfer.
- Mobile: identify selected fish, read genome, return to tank without page overflow.
- Save: rename and transfer, reload, verify name/tank/genome/parents.
- Archive: parent sold; child still navigates to it.
- Capacity: reserve a cohort that would overflow; no fish/currency/IDs change.
- Reduced motion: starts paused; controls remain usable.
- Empty/invalid states: helpful instructions and no dead buttons.

**Lab status (FS-106):** skip links lead to the collection and the inspector. Choosing a fish from a card by keyboard, or any relative in Family, moves focus to the inspector's name heading, and "↩ Collection" returns focus to that fish's card; pointer selection leaves focus where it was. On coarse pointers every button, select, link and checkbox row is at least 44 × 44 px. The header, trait rows, genome rows and inspector tabs reflow at 200% text without clipping or horizontal page overflow. The live canvas is not keyboard-focusable; the collection is the keyboard path to every fish. A screen-reader audit remains open (FS-704).

The verification evidence for the current lab is tracked separately in [TESTING.md](TESTING.md).

## Implemented NPC shop (FS-502)

The collection toolbar opens **NPC shop**. Fixed specimen cards show sex, category, adult length potential, carrier notes, expiry, price and current resale estimate. Sex/category filters and price/length/expiry sorting do not change inventory. **Deliver to** states free places after nursery reservations. Purchases explain credit/capacity/record blockers and select the newcomer after clearing collection filters. Refreshing preserves stock. See [FS-502 verification](research/FS-502-PERSISTENT-SHOP.md).

## Implemented habitat management (FS-503)

The sidebar's Aquariums & expansion link opens Habitat & expansion below the live tank. Purchase and expansion show cost, resulting capacity/volume and balance before confirmation. The decoration editor keeps a separate draft with a footprint map, piece selection and labeled position/size/rotation sliders. Applying shows total new-piece cost; Cancel discards the draft. Invalid placement and insufficient funds prevent Apply. Removal has no refund. Starter tanks remain included; eight tanks and 60 places per tank remain the hard limits. [Evidence](research/FS-503-HABITAT-EXPANSION.md).

## Implemented first-session guide, recovery and family at a glance (FS-504)

**First-session guide.** A panel above the aquarium names the next of seven steps: meet your fish, name a fish, feed the tank, start a courtship, hatch and keep a candidate, trace a family, choose a breeding goal. It shows how many are done, with **Show me**, **All steps** (each step marked Done, Next or Not yet, in text as well as a mark) and **Hide guide**. **Guide · N/7** in the save bar shows or hides it.
- **Show me** moves focus to the control for that step. It never performs the step: the player still selects, renames, feeds, pairs, stars, follows a parent and sets a goal.
- **Completion:** a step completes from the player's own action or from what already exists, and stays complete.
- **Default:** a world that already has bred fish starts with the guide hidden.
- **Ending:** "Guide complete" sets no obligation to return.

**No-money recovery.**
- **Aquarium alert:** when no living female or no living male is left, an alert explains that a new generation needs both. If credits already cover founder stock it offers **Open NPC shop**; otherwise **Review recovery options**.
- **If credits run low**, in **Buyers and ledger**, lists:
  - living females and males;
  - what hatched fish that are not courting would sell for today;
  - free rehoming and free care changes;
  - the koi rescue rule with its current status.
- **Rescue claim:** when the rescue is available, a destination select with free places and **Accept a rescued male · no cost** (or female, or pair) claim it. The notice names the rescued fish and when the rescue can help again.
- **Elsewhere:** the NPC shop links here when no listing is affordable. A care warning whose priced fixes are all unaffordable names a free fix.

**Family at a glance.** Under the name and subtitle, every fish shows **Parents A × B** as links (or founder stock), full siblings, offspring and **Open family tree**. A parent link opens the Family tab at that parent, with **Back** to the fish. A missing parent record reads "(record missing)" instead of a link. See [FS-504 evidence](research/FS-504-ONBOARDING-AND-RECOVERY.md).
