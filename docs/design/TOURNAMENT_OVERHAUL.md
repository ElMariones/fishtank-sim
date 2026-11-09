# Tournament overhaul — critique and redesign

9 November 2026 · FS-133 · world v22 · builds on [COMPETITIONS.md](../COMPETITIONS.md) and [COMPETITION_UI.md](COMPETITION_UI.md)

Design-system level: L1. The Deepwater system ([DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), `src/ui/design/tokens.css`) is the design language and there is
no Figma library, so the overhaul composes only from existing tokens, the shell, `FishPortrait` and `Icon`. The ceremony keeps its warm brass/parchment palette.

## 1. How the circuit worked (FS-122–127)

| Step | Screen | Action / event | Domain |
|---|---|---|---|
| 1 | Board | Species segment + level select; 24 identical cards (6 tiers × 4 species) | `competitionSchedule` |
| 2 | Entry | Pick 1–2 eligible animals, pay | `enter-competition` creates 8 NPCs, **scores, ranks and comments everything immediately** |
| 3 | Exhibition | Browse tanks, inspect | none |
| 4 | Judging | "Invite the judges" → three 1.9 s timed captions | `judge-competition` only flips `phase` and pays |
| 5 | Results | Podium, comments, hidden scorecard, negotiation | `competition-offer` |
| 6 | Close | Back to the board; trophy room lists placements | `close-competition` |

## 2. Critique

Severity: **P1** breaks trust or the core loop, **P2** weakens fun or clarity, **P3** polish.

### Game design
- **P1 — Judging is a replay, not an event.** The outcome is fixed at registration, so the show day has no decisions, no risk and no surprise. "Invite the judges" is a loading bar.
- **P1 — No progression.** Every tier is open on day 0; the only gate is the fee. Nothing to climb, no reason to come back to amateur shows or to aim at Global.
- **P1 — Nothing is personal.** The board never mentions the player's animals; it cannot tell you which fish suits which show, so 24 cards become a guess.
- **P2 — All shows are the same show.** One fixed equal-weight formula. Event "theme" only changes a hue.
- **P2 — Rewards are one-dimensional.** Credits only (5×/3×/2× fee). No reputation, titles, milestones, special awards or season record.
- **P2 — Rivals are anonymous.** Twelve keeper names are drawn at random with no memory, so there is no rivalry.
- **P2 — Comments are generic.** Templates name criteria but never the animal's variety, strain, the show's emphasis or what happened on the day.
- **P3 — Prizes ignore the special qualities the game simulates** (temperament, size, youth, colour).

### UX / UI
- **P1 — Bug: the species segment labels guppies "Axolotls"**, so two buttons say Axolotls; the trophy-room species filter omits guppies.
- **P2 — Board density.** 340 px cards with a decorative glyph and 50% empty space; 24 of them per month. Level is a hidden `<select>`.
- **P2 — Entry gives no decision support.** Cards show condition, not how the animal would score under this show's judging.
- **P2 — Ceremony shows no scores.** Judges "evaluate" with captions; the field never moves; the player learns their placing only after the animation.
- **P2 — Results bury the player's own outcome** under the podium; prize, honours and what to do next are not summarised.
- **P3 — Scorecard is collapsed by default**; no explanation of modifiers because there were none.
- **P3 — No sense of where you are in the flow** (choose → prepare → show day → results).

## 3. Design goals

1. Every show is different and readable at a glance: a **judging brief**, a **special award** and a **show-day bulletin**.
2. A real decision on show day: a **preparation** chosen after reading the bulletin, with visible trade-offs.
3. A career: **reputation** unlocks **licences** tier by tier; **titles**, **milestones**, **season record** and **rivals** persist.
4. Personal: recommendations and projections from *your* animals; comments that name your animal's variety, the brief and the incident.
5. A ceremony that shows the scores: round-by-round live leaderboard, effects applied visibly, then the podium.
6. Honest and deterministic: all modifiers are published per animal; nothing invisible favours NPCs; reloads never reroll.

## 4. The new flow (format 2)

| Step | Screen | Player sees / does |
|---|---|---|
| 1 | **Circuit board** | Career strip (licence, reputation bar to next licence, season medals, top rival). **Recommended for you**: up to three open shows where your best eligible animal has the strongest projected finish. Tier ladder tabs with locks and reputation requirements; species chips (fixed). Compact event cards with brief, special award, fee, prize, your eligible count and best projection. |
| 2 | **Choose entrants** (step 1 of 3) | Animals sorted by projected fit for *this brief*; weighted mini-bars show which criterion the show rewards; estimated finish band. Summary aside: fee, prizes, award, licence check. |
| 3 | **Prepare** (step 2 of 3) | The exhibition hall. Show-day bulletin (incident) names the exhibits it affects. Choose one preparation; each card previews the exact point change for each of your entrants. Rival exhibits are tagged. |
| 4 | **Show day** (step 3 of 3) | Live leaderboard: Presentation, Pattern, Condition rounds reveal weighted points, rows reorder; then show-day effects (incident + preparation) apply with ± badges; then the podium. Skip and reduced-motion jump to the same saved result. |
| 5 | **Results** | "Your show" summary first: placing, points, prize, special award, reputation gained, licence progress (and unlock), titles and milestones earned. Then podium, special award, judges' notes, full scorecard (with effects column, open by default) and negotiation. |
| 6 | **Trophy room** | Career overview (licence, reputation, milestones, rivals' head-to-head), then the animal honours grid with titles. |

### Judging brief (per event, seeded)
| Brief | Presentation | Pattern | Condition |
|---|---|---|---|
| Grand Classic | ⅓ | ⅓ | ⅓ |
| Form & Carriage | ½ | ¼ | ¼ |
| Colour Masters | ¼ | ½ | ¼ |
| Keeper's Cup | ¼ | ¼ | ½ |

### Special award (one per show, any exhibit can win; +1× fee and reputation if yours)
Rising Star (youngest exhibit) · Heavyweight (longest) · Spirit of the Show (boldest) · Finest Colour (highest final pattern score). Ties fall to the lower animal ID.

### Show-day bulletin (seeded incident) and preparations
| Incident | Effect on every affected exhibit | Counter |
|---|---|---|
| Perfect conditions | none | — |
| Heatwave in the hall | condition −5 if entry condition < 85% | Quiet acclimation negates; Show lighting costs a further −2 condition |
| Flickering lights | pattern −4 for all | Show lighting negates |
| Roaring crowd | presentation −4 for shy animals (boldness < 0.45), +2 for bold (> 0.6) | Quiet acclimation negates the shy penalty; Spotlight staging doubles the effect |
| Guest judge loves size | presentation +3 for the three longest exhibits | — |
| Late transport | condition −3 for all | Quiet acclimation negates |

| Preparation (your entrants only) | Base effect |
|---|---|
| Quiet acclimation | condition +1.5 |
| Show lighting | pattern +2.5 |
| Spotlight staging | presentation +3 if boldness ≥ 0.5, otherwise −2 |

NPC exhibits receive incident effects but no preparation — they are shown in the scorecard, so the advantage is visible and earned.

### Career (derived from history, never stored)
- Reputation per animal and show = tier base × placement factor, plus tier base for a special award. Tier base 4/6/10/16/24/36; factor 3 (1st), 2 (2nd), 1.5 (3rd), 1 (4th–5th), 0.5 (otherwise).
- Licences: Amateur 0, Entry 10, Regional 35, National 90, Pro 200, Global 400 reputation. A tier the world already entered stays licensed (migrated saves keep access).
- Titles: highest of Podium Finisher → Show Winner → Regional / National / Pro / Global Champion (gold at that tier).
- Milestones: first show, first podium, first gold, double podium, special award, each licence, golds with three species, ten shows.
- Rivals: per keeper, head-to-head of your best placing against their best placing in shared shows.

## 5. Contracts
- Format 2 runs carry `show` (brief, award, incident, tactic, award winner) and per-participant `adjust`; format 1 runs and journals replay unchanged. Commands without `format: 2` create format-1 runs.
- Scores at the exhibition phase are base scores ranked by the brief; judging re-ranks with published adjustments. Asking prices use the base total and never change.
- Brief, award and incident come from `${seed}:circuit:2:${eventId}` — independent of inheritance streams and known before entry.
- Reputation, licences, titles, milestones and rivals are derived from history; no second mutable counter.
- Projections are labelled estimates from sampled typical fields, never the real field.
