# Competition circuit and calendar

Design and implementation brief · 21 September 2026 · FS-122–127

## Player promise

Raise an animal with a recognizable inherited appearance, take it to a named aquatic show, meet rival breeders, watch the judges assess the exhibits, and bring a lasting story home. Both koi and axolotls have their own events. Competitions add a reason to care for and select animals; they do not alter genomes or declare objectively superior biology.

This document records the requested complete flow: a Competitions navigation button; procedurally named events in different cities and venues; amateur through global tiers; paid registration for one or two animals; a searchable and filtered entrant collection; a separate themed exhibition; inspectable rival tanks; player-triggered judging; animated scoring and podium reveal; full rankings; varied judge explanations for podium and player animals; negotiations to acquire NPC rivals; permanent animal honors; a trophy room; and explicit calendar advancement that also advances growth and births.

## Scope and setting

The circuit is a local, editable sandbox. Opponents and breeders are NPCs. Global is a prestige tier in this fictional circuit, not an online leaderboard. Real player messaging, multiplayer trading and verified market prestige remain later work.

Use a fictional 360-day year with twelve 30-day months. New calendars begin at Year 1, January 1; migrated saves retain their elapsed game days. A day/week/month button advances 1/7/30 simulation days. The date never advances while idling, judging, decorating, or while the app is closed. Swimming animation is independent of calendar time. A reduced-motion preference and an explicit motion toggle remain available.

Each monthly entry window has separate koi and axolotl events across six tiers: amateur, entry, regional, national, pro and global. Event identity includes its year and window, so each named edition can be entered only once. Advancing beyond the closing day replaces unopened events; a paid exhibition can still be completed. An event pays once per entered animal that places in the top three. No refunds or abandon-and-reroll mechanic. Finish and archive an event before entering another.

## Journey

1. Open Competitions. Read the date, closing window, species, tier, entry cost per animal and podium prizes. Filter by species or tier. Each event displays its generated city, venue and name.
2. Apply to an event. Browse current owned animals across tanks; search and filter the selection. Show actual current appearance, condition, and eligibility. Pick one or two distinct animals of the event species. Explain blockers and the final fee before the registration button.
3. Registration atomically validates availability, eligibility, credits, duplicate participation and result-record capacity. It saves the entrant snapshots and opponents, deducts the fee and opens the exhibition. Invalid registration changes nothing.
4. Inspect the exhibits. Player animals are clearly marked. Each opponent has a persistent specimen identity, generated breeder, visible phenotype and saved condition. Inspecting never advances the calendar or changes the eventual outcome.
5. Begin judging when ready. Three criterion passes highlight presentation, pattern and condition. Show judge names and active assessment, then reveal the podium. Provide a skip action and reduced-motion path. Commit the result and prize exactly once; animations only present that saved result, so reloading never rerolls a show.
6. Celebrate the top three, with gold, silver and bronze treatments. Show a personalized judge comment and criterion breakdown for the podium and every player entrant. Keep the complete points table available, including ties resolved by a stable identity ordering.
7. Make an offer for a rival. Display the NPC breeder, asking price, integer offer and destination aquarium. The owner accepts, counters or ends talks after a bounded number of attempts. Counteroffers are saved and can be explicitly accepted. A completed acquisition charges once and transfers the exact exhibited animal, including its genome, identity and show history. Capacity and reserved nursery places apply. No external person is contacted.
8. Archive the finished event and return to the board. Trophy room groups honors by animal, with current ownership as the default and archive access. An animal profile shows all recorded placements, not just wins. Selling or rehoming cannot erase history.

## Fair and explainable judging

Use expressed, species-aware phenotype and the saved current condition. Presentation and pattern are exhibition preferences, not market value, pedigree inbreeding, heterozygosity or global rarity. Publish the three criterion scores and total. NPC difficulty comes from deterministic candidate selection at higher tiers; never award opponents invisible score bonuses. The event stream is separate from inheritance streams.

Flavor text combines seeded openings, observed strongest and weakest criteria, placement reactions and breeder context. It must agree with the numeric result and never claim unsupported anatomical defects, genetic rarity, simulated life-history traits, or real biological quality. Store the text with the result so future naming changes do not rewrite its story.

## Calendar consequences

The existing absolute simulation tick remains the source of truth. Advance through the existing water/care/development/courtship integration, preserving day boundaries and deterministic births. A month skip is thirty daily steps, not a shortcut that merely changes the displayed date. Feeder settings continue to apply; poor water and nutrition can affect growth and condition. Show a post-skip care and birth summary. Calendar controls are unavailable during registration/exhibition until a paid event has been resolved, during an aquascape draft, while saving/importing, or in a read-only tab. The current research model does not simulate death.

## Persistence and safety

World v15 adds a versioned competition state containing the current circuit day, at most one active show and a bounded history. Entrant snapshots retain appearance and score at exhibition time. Purchased NPC identities remain the same as their historic exhibit IDs. Reject malformed events, duplicate participants, invalid species/genomes, forged rankings or repeated rewards; keep unsupported saves intact. Old worlds migrate without changing their existing genomes, IDs or parent links. Runtime journal replay includes competition commands and time advances.

All credit changes use the reconciled ledger. Domain validation is atomic. Competition awards are keyed by event and animal identity; there is no second mutable medal counter that could disagree with the results. History exhaustion is explained before registration and never silently truncates honors.

## Work breakdown and acceptance

| Ticket | Workstream | Acceptance |
|---|---|---|
| FS-122 | Brief and visual direction | This specification, generated concept, design translation document and backlog entries exist before UI integration. |
| FS-123 | Calendar integration | Day/week/month advances actual care, growth and scheduled births; no wall-clock/offline progress; reload retains the chosen date. |
| FS-124 | Circuit domain and saves | Stable generated events, both species and all tiers; atomic fees, one/two entrants, deterministic scores, single payout, v14 migration and replay tested. |
| FS-125 | Exhibition and ceremony | Filtered application, inspectable exhibits, judge animation/skip, podium, full scores and varied explanations work in browser. |
| FS-126 | NPC negotiation | Offer/counter/accept/end behavior; exact specimen transfer and debit; capacity, affordability and duplicate purchase rejection tested. |
| FS-127 | Honors and release verification | Individual placements and trophy room persist through reload and ownership changes; core tests/build and complete browser journey recorded. |

Implementation evidence and limitations belong in [TESTING.md](TESTING.md) and [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md). Do not infer completion from this design document.
