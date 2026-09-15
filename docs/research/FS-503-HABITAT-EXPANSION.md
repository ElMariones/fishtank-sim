# FS-503 — Aquarium expansion and placed decorations

**Date:** 15 September 2026. **Status:** DONE, pushed `f78d007`. M5 remains open until FS-504 and FS-505.

## Delivered behavior

- Two existing starter tanks and all migrated tanks keep their capacity, water, fish, names and equipment.

- **Habitat & expansion**, below the aquarium and linked from the sidebar, reviews a new aquarium (400 credits, 20 places, 10,000 L, Standard equipment) or an expansion (300 credits, up to 20 more places and 10,000 L, maximum 60 places). Eight tanks remains the limit. Purchases use the equipment ledger with readable entries.

- Expansion preserves residents and courtship reservations. Ammonia mass and uneaten food are conserved while clean water is added at the existing temperature and oxygen concentration. Filter and aeration capacity stay unchanged.

- Up to 12 plant/rock pieces per tank. The editor previews normalized position, size and rotation, supports keyboard sliders, and applies the reviewed layout atomically. New pieces cost 25 credits; edits and removal are free, with no refund. Unsafe rock placements, overlaps, duplicates, out-of-range values and insufficient funds reject without mutation.

- Canvas and worker protocol 3 receive the same placed footprints. Plants are permeable hiding targets; rocks redirect steering and enforce body-center clearance. Latest footprints survive a worker restart. Rotation changes plant drawing and rock vein direction; circular footprint radius is invariant under rotation.

## Compatibility and scope

World v8 appends decorations to each tank. Older planted flags become the original four-piece layout. V7 replay still checks water, life, shop and ledger, omitting only the newly introduced decorations (and names if the naming model is old). V7 stock is preserved rather than redelivered. Pre-v7 saves retain their existing migration strategy. Future/corrupt saves still fail validation without replacement.

Legacy `add-tank` and `decorate` remain only for historical journals and research scenarios; the live UI uses paid commands. Local worlds remain editable sandboxes. No genome, fish identity or phenotype contract changed. Validation schemas live separately from layout helpers to keep Zod out of the motion worker (12.54 kB built).

## Automated evidence

Windows, Node 24.11.1, npm 11.6.2. `npm run check`: **174 tests in 29 files passed**, followed by a successful strict TypeScript/production build. Vite reports its non-failing 500 kB chunk advisory for the main bundle (534.82 kB; 171.10 kB gzip).

Six new fixtures cover purchase/expansion costs, reservation-aware arrivals, pollutant conservation, limits and atomic rejection, layout price/replay/idempotence, v7 migration with old free commands and retained stock, rock clearance over 400 motion steps and moved plant hiding targets. Existing worker recovery coverage now verifies retained footprints. The naming migration fixture explicitly identifies its historical world as v7.

## Browser evidence

Codex in-app Chromium, isolated `http://127.0.0.1:5181/`; user worlds on other ports were not edited. The agent-browser CLI was unavailable, so the connected browser was used.

1. New aquarium review showed 400 credits and balance after 800. Confirm created tank 3 with 20 places.

2. Expansion review showed 20 to 40 places, 10,000 extra litres, 300 credits and balance after 500. Confirm applied and saved.

3. Keyboard Home on a rock's horizontal position produced the glass-clearance warning and disabled Apply. Moved to x=35%, y=50%, size=80%, rotation=125 degrees and saved for 25 credits. Added plants at x=75% for another 25.

4. Exported the QA save and reloaded after the UI reported Saved on this device. Tank 3 retained 40 places and both pieces; reopening the editor showed the exact rock transform and zero edit cost.

5. At 390 × 844, document width was 375 px (scrollbar excluded), with no horizontal overflow; screenshot inspected. Position sliders worked by keyboard. Viewport override was reset.

6. Moved the rock for zero credits, expanded to 60 places/30,000 L, and removed the rock for zero credits. Balance remained 150; purchase and expansion buttons disabled. A no-funds explanation pointed to sales and free rehoming. Haru moved to tank 3, leaving five fish in the garden and one in tank 3.

7. Ledger showed 400 + 300 + 25 + 25 + 300 = 1,050 equipment spending, opening 1,200 and balance 150. Saved status visible; no captured browser warnings/errors on the completed journey.

During implementation, tests caught and fixed a double deduction because the existing `afford` helper already debits credits. An initial browser run kept the earlier reducer in its save handler after hot reload and refused to persist that inconsistent journal. A fresh module load and repeated journey saved successfully; final tests also replay purchases after advancing time. No invalid snapshot replaced a valid save.

## Remaining limits

This completes FS-503's bounded interaction, not M5's first-session or no-softlock gate. FS-504 onboarding/recovery and FS-505 playtests/source-sink analysis remain. Food/breeding have no ongoing charge. Frozen E-05 still uses free research tanks and must not be presented as the paid-expansion balance report. Circular footprints are a visual proxy, extreme fins can overlap, and placement is by controls rather than drag-and-drop. No full accessibility or cross-browser audit was performed.
