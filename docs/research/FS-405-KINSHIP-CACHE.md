# FS-405 incremental kinship cache and founder assumptions

**Recorded:** 14 September 2026 · **Status:** DONE, pushed `850f501`
**Models:** world save v5 (unchanged) · genome v2 · kinship values unchanged under the default founder assumption

## Starting state

`c741d20` (FS-404 marked DONE) was HEAD and `origin/main`, with no tracked changes. Only `.claude/launch.json` was untracked.

## Scope

FS-405 asks for an incremental kinship cache with unknown-founder assumptions and reference fixtures. FS-112 had left caching across queries as future work. Before this change, every new world or fish selection recomputed kinship from scratch over all records, and the founder assumption appeared only in help text.

## Model

`src/core/pedigree.ts` exposes `createKinshipCache(fish, assumption, limit)`.

**Records and invalidation.** The cache stores each record's ID, generation and parents, plus a table of computed ancestor pairs.
- **Sync:** `sync(fish)` adds records it has not seen and keeps every computed pair. That is safe because valid saves never change a recorded parent or generation, and records are never deleted.
- **Rebuild:** it rebuilds only when a known record's parents or generation differ, a record disappears or an ID repeats, as after an import, recovery or tampered data.
- **Same array:** handed the same array again, it skips the scan.
- **Pair limit:** past 500,000 pairs, the table starts over before the next query.

**Queries.** Queries keep the FS-112 explicit-stack recursion, expanding the younger fish of each pair toward the founders:
- `kinship(a, b)` returns A[a,b] / 2.
- `inbreeding(id)` returns the parents' kinship.
- `founders(ids)` lists the founders behind the given fish, and any parent IDs with no record.

The old `kinship(fish, a, b)` function builds a one-off cache, so every existing kinship test exercises the same code.

**Founder assumption.** Founders follow an explicit, validated `FounderAssumption`.
- **Default:** unrelated and not inbred, as before: kinship 0 between founders and 0.5 with themselves.
- **Base population:** a founder coancestry f₀ and inbreeding F₀ give A[i,j] = 2f₀ between different founders and A[i,i] = 1 + F₀. Values outside 0 ≤ F₀ < 1 and 0 ≤ f₀ ≤ (1 + F₀)/2 reject.
- **Unrecorded parents:** a parent ID with no record counts as one more founder, so the link through that parent is invisible.

**App.** One cache lives in App state for the session. It serves expected pedigree F in the breeding panel, the inspector's pedigree F and the founder counts.
- **Breeding panel:** normal breeding reads "Expected pedigree F: X%, from recorded ancestry; the N founders behind this pair are assumed unrelated and not inbred."
- **Family view:** the closing note says how many founders in the fish's recorded ancestry its F assumes.

## Fixtures

`tests/kinship.test.ts` (6 tests):

| Fixture | Result |
|---|---|
| Textbook relationships | Exact in both argument orders and equal to the uncached function: unrelated founders 0, self 0.5, parent–offspring 0.25, full siblings 0.25, half siblings 0.125, grandparent 0.125, aunt or uncle 0.125, first cousins 0.0625, double first cousins 0.125, half first cousins 0.03125, second cousins 0.015625, and self 0.625 for a full-sib offspring with F 0.25. Founders and unknown IDs have F 0 |
| Regular inbreeding | Twelve generations of full-sib mating follow Wright's recurrence F(t) = (1 + 2F(t−1) + F(t−2)) / 4 (0.25, 0.375, 0.5, 0.59375, 0.671875 …). Nine backcrosses of daughters to one sire follow F(t) = (F(t−1) + ½) / 2, reaching 0.4375 at the fourth |
| Founder assumptions | With founders related at 0.1 and inbred at 0.1: founders 0.1 apart and 0.55 with themselves, full siblings 0.325, and offspring of different founder pairs 0.1. On a 300-record inbred pedigree with two records removed, 600 random pairs (every fifth a self pair) under the default, the 0.1 assumption and a 0.05 base population match the tabular relationship matrix within 1e-12. A removed record reads as the assumed coancestry. Negative, full or excessive coancestry and NaN reject |
| Founder listing | Built with real commands: a lab cross, hatching, a sibling cross, a sale and a purchase. The grandchild has F 0.25, the bought newcomer is unrelated, and the founders behind them are both originals plus the newcomer. Removing the father's record lists him as missing, and the grandchild's F drops to 0.125, matching the tabular matrix, because the siblings then share only a recorded mother |
| Incremental reuse | A cache that computed F for 239 generations of sibling mating syncs two new generations without rebuilding. The newest generation's F computes at most 12 new pairs, under a twentieth of a fresh cache, with an identical value; asking again computes none |
| Rebuilds and limit | Syncing the same records, or copies renamed and sold, keeps every pair. Changed parents, a smaller record set and a duplicate ID each rebuild (three resets), and results then match the tabular matrix. A 40-pair limit clears the table during 150 queries and returns identical values |

**Found and fixed before commit:**
- **Wrong expectation for an unrecorded father.** The founder-listing fixture first expected a full-sib grandchild to keep F 0.25 after its father's record was removed. The cache returned 0.125, and so does the tabular matrix: without the record, the siblings share only their recorded mother. The expectation was wrong; the fixture now asserts 0.125 against the reference and explains why missing parents are reported.
- **Console error during hot reload.** App.tsx was edited in several steps, and the dev server rendered an in-between module that logged "kinship is not defined" once per tab.
  - The in-app console keeps entries across reloads: a marker logged before a reload was still listed afterwards.
  - The error count stayed at one through two reloads and every later render of F values, so it did not recur.
  - Strict TypeScript confirms no unresolved identifier.

## Browser verification

In-app Chromium, with the `fishtank-qa` server on port 5176, after a full reload of each origin:

- **QA world (`http://localhost:5176`):**
  - Normal breeding for Haru × Sumi read "Expected pedigree F: 0.0%, from recorded ancestry; the 2 founders behind this pair are assumed unrelated and not inbred."
  - Found through the family search, Fry 31's closing note read "Pedigree F (0.0%) uses every recorded generation, not only those shown, and assumes the 2 founders in this recorded ancestry are unrelated and not inbred."
- **Generated deep lineage (`http://127.0.0.1:5176`):** choosing the generation 9 siblings Tomo × Yori as parents read "Expected pedigree F: 85.4%, from recorded ancestry; the 2 founders behind this pair are assumed unrelated and not inbred." **Instant lab cross** showed the same 85.4%.
- **New records:** the lab cross laid 20 eggs in The Koi Garden. The first, Fry 187, entered the session cache through an incremental sync, and its inspector read "Pedigree inbreeding F 85.4%", the value shown before the cross.
- **Console:** apart from the retained hot-reload entry described above, no errors.

## Limitations

- **Session only:** the cache lives in memory, so after a reload pairs are computed again on first use.
- **Main thread:** kinship still runs there, and a first query on a pathological 10,000-record pedigree can still need quadratic pair work (FS-702).
- **Assumed founder relatedness:** it is not estimated from genomes. The app always uses the unrelated default; other assumptions exist only in core and tests (FS-603).
- **Missing parent records:** they lower F for that line. The Family view counts missing positions, but the breeding panel reports only founders.
- **Selection experiment:** it keeps its own numeric coancestry cache, unchanged so FS-105 results stay reproducible.
