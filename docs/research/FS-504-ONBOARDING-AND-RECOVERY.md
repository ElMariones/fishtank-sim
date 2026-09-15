# FS-504 — First-session guide, no-money recovery and family at a glance

**Date:** 15 September 2026. **Status:** DONE, pushed `6335851`. M5 remains open until FS-505.
**Models:** world save v9 · relief model 1 · economy model v1 · naming model 3 · genome v2

## Starting state

`e443ef9` (FS-503 marked DONE) was HEAD and equal to `origin/main` after a fetch, with no tracked changes. Only `.claude/launch.json` was untracked. The baseline suite passed: 174 tests in 29 files.

## Scope

FS-504 asks for first-session onboarding, no-money recovery and discoverable family inspection. The bar comes from four places:
- the GDD's proposed first session (§4) and its rule that upkeep must never strand a player permanently (§10);
- BALANCE's target of no early economic softlock;
- M5's gate: complete the first-session loop and avoid economic softlock;
- ADR-046's revisit trigger for no-money recovery.

## Delivered behavior

**First-session guide** (`src/core/onboarding.ts`, `OnboardingGuide.tsx`). Seven steps follow the GDD sequence: meet a fish, name it, feed the tank, start a courtship, hatch and keep a candidate, trace a family, and choose an optional breeding goal.
- **Panel:** above the aquarium it shows the next step with **Show me**, **All steps** and **Hide guide**. The save bar has a **Guide · N/7** toggle.
- **Completion:** selecting a fish, renaming, feeding and following a parent are recorded when the player does them. A courtship or bred fish, a starred hatched offspring and a goal complete their steps from the world and preferences. A completed step stays complete.
- **Show me** only points. It focuses the collection, the rename field, **＋ Feed**, the mother picker or **＋ Add goal**, shows the latest clutch, or opens a bred fish's Family tab. It never runs a command.
- **Storage:** progress sits beside collection preferences under its own key, never in the world save or exports. A world that already has a lineage starts with the guide hidden, and invalid or future data falls back to a fresh guide.
- **Ending:** the completion text sets no obligation to return.

**No-money recovery** (`src/core/recovery.ts`, world save v9).
- **Why only one rescue rule:** while fish of both sexes live, a lineage continues for free, since breeding, food, moves, rehoming and lower care settings cost nothing. The one economic dead end is losing every fish of one sex without credits for stock.
- **Koi rescue:** `claim-relief` gives one unrelated adult founder of each sex with no living fish, at no cost, while credits are below ◈ 250 (the founder price) for each missing sex. It then waits 10 game days, counted at day boundaries. Rescued fish follow the same capacity and population checks as any arrival and get truthful generated names. Each rescue writes a ◈ 0 **Unrelated stock** ledger entry, so the ledger still reconciles.
- **Aquarium alert:** "No living male is left" (or female, or fish) explains what a new generation needs. It offers **Review recovery options**, or **Open NPC shop** when credits already cover stock.
- **If credits run low**, in **Buyers and ledger**, shows:
  - how many living females and males there are;
  - what hatched fish that are not courting would sell for today under the shared sale plan;
  - that rehoming and care changes are free;
  - the rescue's rule and current status, with a destination select and **Accept … · no cost**.
- **Pointers elsewhere:** the NPC shop links to these options when no listing is affordable, and the no-funds note in Habitat & expansion points to them.
- **Care warnings:** they name a free fix whenever every priced fix is out of reach. The crowding warning used to add a free legacy tank in one click, bypassing FS-503 prices. It now points to moving, selling or rehoming fish, and to a reviewed aquarium purchase.

**Family at a glance.** Under every fish's name the inspector shows **Parents A × B** as links (or "Founder stock"), full siblings, offspring and **Open family tree**. A parent link opens the Family tab at that parent with a Back trail and brings its aquarium into view. The FS-404 family view itself is unchanged.

## Compatibility

- **World v9:** appends `relief: { model: 1, claims, cooldownDays }`. Worlds v1–v8 migrate with no claims and nothing to wait for, keeping the v9 key order.
- **Replay:** v8 snapshots are now compared in full, decorations included; only v7 and older omit decorations. A save with a wait but no claim, or a wait over 10 days, is refused.
- **Unchanged:** genomes, phenotypes, prices, shop stock and breeding rules. Guide progress is device-local, like other preferences.

## Automated evidence

Windows 11, Node 22.18.0, npm 10.9.3. `npm run check`: **186 tests in 31 files** pass, followed by the strict TypeScript and production build. Vite keeps its non-failing advisory for the main chunk (549.59 kB; 175.84 kB gzip).

`tests/recovery.test.ts` (9 tests):

| Fixture | Result |
|---|---|
| Rescue | A world with no males and ◈ 100 receives FSH-000007, a genome v2 adult male in The Koi Garden. Credits stay ◈ 100, the ledger adds "Koi rescue: … at no cost" for ◈ 0, relief reads 1 claim and 10 days, and the save round-trips. Haru's pairing with him passes every blocker and commits. With no fish at all, a female and a male arrive together with distinct names. ◈ 499 still qualifies when both sexes are missing |
| Refusals | Each of these is refused with no change: both sexes present, ◈ 250 with one sex missing, ◈ 500 with both, a pending wait, a full tank, an unknown tank and an invalid genome version. The default destination skips the full tank |
| Wait and replay | After nine game days one day remains and the claim is refused with "again in 1 game day."; the tenth day clears the wait. Day-by-day advances equal one advance, a second rescue restarts the wait, and the journal replays. A tampered wait fails replay; a wait without a claim, or over 10 days, is refused |
| Migration | A world v8 save migrates to the same world with the same key order. A v8 runtime rebases, and a tampered v8 decoration still fails replay |
| Not an income | For 60 game days, a keeper with no males claims whenever allowed, sells each rescued male to its best offer, and turns the proceeds into stock rehomed at once to stay eligible. Result: 6 claims, ◈ 356 sale income (at most 6 × ◈ 150), ◈ 320 spent, ◈ 36 left, with the ledger reconciled |
| Hard starts | A route to an accepted normal pairing that uses only cancelling, rehoming, moving, free care settings, waiting, the rescue or stock the credits already cover: with nobody left and ◈ 0, a rescue at once (0 game days). With a rescue pending, 10 game days. With only eggs, no rescue and 28 game days until the parents are adults. With no males and ◈ 1,000, a ◈ 250 founder bought at once. No route needs credits beyond stock the player can already afford |
| Softlock walk | 500 seeded steps of crosses, courtships, sales, rehoming (including whole sexes), stock purchases, tanks, expansions, care changes, water changes, rescues and time. 219 steps lacked a sex. 24 recovery checks each reached an accepted pairing within 22 game days without gaining credits, and the ledger reconciled after every step |
| Care guidance | High ammonia on measured rations gets a hint ending "which is free" only at ◈ 0. A crowded tank offers only hints, every warning has a free or affordable fix, and no fix issues `add-tank` |
| Overview | Six founders read 3 females and 3 males, 6 fish that can be sold or rehomed, and the shared plan's count and total. A courting pair lowers that to 4, and an empty world is offered a rescued pair |

`tests/onboarding.test.ts` (3 tests):

| Fixture | Result |
|---|---|
| Storage | A fresh world shows the guide and a world with a lineage hides it. Stored steps are deduplicated and put in guide order; malformed, future-version, unknown-step and extra-key data fall back to a fresh guide. The key differs from the save and preference keys, and worlds carry no guide field |
| Order and stickiness | Steps record in guide order, an already recorded step returns the same object, and a cancelled courtship counts as a lineage |
| First session through commands | Rename, feed and a pairing complete four steps. A starred egg does not complete the hatch step; the eggs hatch within 8 game days and then it does. A goal and a followed parent complete the guide. After the kept fish is rehomed and its star and the goal are cleared, only the courtship is still observed, and the guide stays complete |

**Found and fixed before commit:**
- **Free tank:** the crowding care warning ran the free legacy `add-tank` command from the live UI, bypassing FS-503 prices.
- **Wording:** the recovery panel said "hatched fishs"; it now reads "hatched fish that are not courting".
- **Guide fixture:** it expected a rehomed favorite to stop counting. Archived records still count as kept, so the fixture now clears the star to show that completion is stored.

## Browser evidence

In-app Chromium (Claude desktop browser pane) against a fresh world on isolated `http://localhost:5182`, served by the new untracked `fishtank-fs504` launch entry. No other origin was touched.

1. **First load:** the guide read "Step 1: Meet your fish", 0 of 7. Haru's inspector read "Founder stock · no recorded parents · 0 offspring · Open family tree". No console errors.
2. **Select and rename:** clicking Haru's card made it 1 of 7. Renaming to Ember with **Save** showed "Fish name updated." and recorded the step. The pane's synthetic Enter key did not submit the form on two tries, while the Save button did; FS-106 verified keyboard submission earlier, and it was not re-tested with a physical keyboard here.
3. **Feed and court:** **＋ Feed** was recorded, and **Start courtship** reserved 20 places in Breeding Studio, completing step 4.
4. **Time:** in this isolated origin only, the stored snapshot's save time was moved back 9.5 minutes and the page reloaded. The return summary read "9 game days passed", and clutch Ember × Sumi had hatched.
5. **Keep a candidate:** **Show me** on step 5 opened Breeding Studio filtered to "Ember × Sumi · 20" and focused the collection with a notice. Starring the fry "Zesty Apricot of the Ferns" completed the step.
6. **Trace a family:** selecting that fry showed "Parents Ember × Sumi · 19 full siblings · 0 offspring · Open family tree". The Ember link opened Ember's Family tab with the trail "Zesty Apricot of the Ferns › Ember" and "← Back to Zesty Apricot of the Ferns". It switched to The Koi Garden, focused the inspector heading and completed step 6.
7. **Goal:** **Show me** focused **＋ Add goal**, and adding a goal gave "Guide complete" and **Guide · 7/7**.
8. **Spending down:** three reviewed aquarium purchases took credits from ◈ 1,200 to 800, 400 and 0; the expansion button stayed disabled for the 60-place garden. Rehoming the three founder males raised no alert, because 9 male fry were alive. Rehoming those 9 raised "No living male is left … the koi rescue offers one male at no cost."
9. **Recovery options:** **Review recovery options** opened Buyers and ledger with focus on "If credits run low". It listed 14 females and 0 males, and 13 of 14 hatched fish with buyers for ◈ 319. The destination defaulted to Breeding Studio, with 49 free places.
10. **Rescue:** **Accept a rescued male · no cost** added Brave Moose (male) to Breeding Studio. Credits stayed ◈ 0, the ledger showed "#6 · Unrelated stock · 1 fish · Koi rescue: Brave Moose at no cost · ◈ 0", the stored relief was `{ claims: 1, cooldownDays: 10 }`, the status read "Saved on this device" and the alert disappeared.
11. **Ready to breed:** moving Brave Moose to The Koi Garden made the planner read "Ready: Ember and Brave Moose can court in The Koi Garden…", with no blockers and **Start courtship** enabled.
12. **Phone:** at 390 × 844 with a coarse pointer there was no horizontal overflow. The guide buttons, **Guide**, **Saves** and the family link were 44 px tall, and the recovery options fit between 27 and 363 px as 336 px single-column items. The viewport was reset afterwards. The console showed no errors during the journey. Phone-width screenshots timed out in the pane, so this layout evidence is measured rather than captured.

## Remaining limits

- **Guide:** one English sequence. There is no tutorial world or time compression, and it cannot tell when a player is confused. Whether 80% of first-session testers finish without help remains for FS-505 and FS-705.
- **Guide storage:** progress is per device, so a save imported elsewhere starts with a fresh or hidden guide.
- **Dead ends:** the rescue covers the only economic dead end under current rules, which have no upkeep, and upkeep would need it revisited. Other stuck-feeling states are slow rather than permanent. An eggs-only world waits about 28 game days, and a player with ◈ 250 or more but no affordable listing of the missing sex waits for deliveries.
- **Rescue resale:** rescued founders can still be sold, bounded at ◈ 150 per missing sex every 10 game days; the farming fixture measured ◈ 356 over 60 game days.
- **Evidence scope:** the walk and fixtures use one seed each and are not playtests, so FS-505 must run paid-economy strategies that include rescues. The browser time jump changed a stored save time in a test origin and does not exercise long real absences.
