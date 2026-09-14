# FS-502 — Persistent NPC shop

Status: implemented and verified; awaiting push before marking DONE.

## Review and scope

Started on 14 September 2026 at `5704c4b`, equal to freshly fetched `origin/main`, with no unpushed commits. The working tree already contained the shop domain, UI, migrations and four tests. Reviewed that work alongside FS-501's economy and FS-406's cohort workflow. Preserved the unrelated `.claude/launch.json` file.

## Delivered behavior

- World save v7 persists six stock listings, each with an ID, genome, sex, name, price, expiry and any documented carrier allele. Opening, filtering or reloading never generates new stock.
- Empty places refill every three game days; listings expire after nine game days. Generation uses the world seed and a monotonic listing sequence, outside the fish inheritance stream.
- Founders cost 250 credits, visible variants 320 and documented carriers 360. Founder resale remains capped at 150. All listings are unrelated founders by pedigree assumption.
- `buy-listing` transfers the exact specimen into a new permanent fish record, removes the listing, debits credits and records the stock expense atomically. Tank capacity, nursery reservations, living population and record limits still apply. Legacy `buy` remains for old journals and existing research scenarios.
- The shop filters by sex and category, sorts by price, adult length or expiry, and lets the keeper choose a destination. Cards show adult potential, hidden carrier information, expiry and current resale estimates. Disabled purchases explain the blocker.

## Review fixes and quality improvements

- **Migration expiry:** a world that already reached day 40 originally received listings expiring at day 9. Runtime migration now dates the first delivery from the saved day, giving it the full nine-day stay and a three-day delivery interval. Bare world imports start at runtime day zero as before.
- **Save integrity:** reject duplicate or invalid listing IDs, impossible expiry relative to delivery, model-inconsistent prices, and carrier documentation that disagrees with the genome. Listing IDs continue beyond six digits.
- **Purchase visibility:** clear collection sex, favorite, parent, clutch and search filters after buying so the selected newcomer is visible.
- **UI cost:** scan residents once per fish-array change and reuse listing preview specimens. Research and Visual fixtures load on demand behind accessible loading messages.
- **Phone layout:** shorter introductory copy, descriptive purchase names and explicit select labels; a full-width destination selector avoids clipping the aquarium/free-space label observed during QA.

## Verification

- `npm test`: 162 tests in 27 files pass. Five shop tests cover seeded categories and hidden alleles across 60 seeds, resale bounds, delivery/expiry, split-time equivalence, replay, atomic failures, nursery reservations, world-v6 migration at day 40, round-trip serialization and corrupt metadata.
- `npm run build`: strict TypeScript and production build pass. Initial JavaScript decreases from 578.62 kB (181.23 kB gzip) to approximately 508 kB (161 kB gzip) by deferring research surfaces. Vite's 500 kB chunk warning remains; this is bundle-size evidence, not a frame-rate benchmark.
- In-app Chromium on isolated `127.0.0.1:5178`: selected the carrier filter (Riku, hidden silver eye copy), combined it with males to reach the empty-filter message, then restored stock. Size sorting showed descending adult length.
- With the collection filtered to females, bought male Tama (`LS-000001`) into Breeding Studio for 250. The collection reset to show Tama as `FSH-000007`. Reload preserved the remaining five listings and a 950-credit balance; the ledger showed one stock debit and the listing ID.
- Bought Riku, Umi and Kin for 360, 320 and 250. At 20 credits, both remaining purchases were disabled with “Needs ◈ 230 more.”
- At 375 × 812, no horizontal page overflow. Visually checked the stock cards and corrected the clipped destination selector, then verified the full destination label. This is a responsive check, not a complete touch/accessibility audit.
- Research and Visual fixtures both loaded after navigation. Visual fixtures reported 0/858 anatomy failures. No browser warning/error logs during the checked journey.

## Remaining scope

FS-503: tank purchases/upgrades and persisted decoration transforms with functional footprints. FS-504: onboarding and no-money recovery. FS-505: whole-loop playtest and economy source/sink report. These are still open; FS-502 does not complete M5's gate. Stock itself does not age or need care while listed. Existing E-05 research uses legacy generated purchases; it is not evidence for a full persistent-shop strategy simulation.
