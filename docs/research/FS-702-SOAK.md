# FS-702 — 100-generation and 2000-record soak

**Date:** 20 September 2026. **Status:** DONE, pushed `b8fde77`. One scaling defect found and recorded, not fixed.
**Models:** world save v14 · genome v3 · renderer v7. No save, command, genome or visual change.

## Starting state

`b19aa68` (FS-701 framing correction) was HEAD and equal to `origin/main`. Baseline suite: 299 tests in 46 files.

## Scope

FS-702 asks for a 100-generation and 2000-owned-fish soak with no invalid records, leaks or duplicate events.

**Interpreting "2000 owned fish".** The design caps *living* fish at `MAX_LIVING` — 8 tanks × 60 places = **480** — so two thousand living fish is not reachable, and was never the thing at risk. What grows without a ceiling during play is the **record set**: living plus sold plus rehomed, capped only by `MAX_RECORDS` (10 000). The soak therefore grows to 2000 records, which is the number a long-running save actually approaches.

## What the soak does

`src/core/soakScenario.ts`, driven by `tests/soak.test.ts`. Like the other scenario harnesses it sends only real commands through `executeCommand` and never edits a world directly.

1. **Deep lineage** — 100 successive generations, each child bred from the previous generation's pair. Everything but the next pair is archived with `rehome-batch`, which is economy-neutral, so living fish stay at two while records accumulate.
2. **Record growth** — larger crosses until the record set passes 2000, retiring the outgoing pair each cycle.
3. **Cost sampling** — a short burst of `rename` commands every 250 records, timed.
4. **A populated finish** — the last clutch stays in the tank, so the end state exercises code that walks the living set rather than a world of two fish.

Checks, sampled every ten generations and again at the end: unique fish, clutch, bloodline, ledger, journal-event and journal-command identifiers; strictly increasing ledger sequence; `decodeSave` accepts the world; pedigree F stays finite in 0–1; and every bounded structure is still bounded. At the end it also decodes and replays the runtime, re-submits a recorded command to confirm it is absorbed rather than applied twice, and submits a stale-revision command to confirm it is refused.

## Result — the soak passes

| | |
|---|---:|
| Generations reached | **151** (target 100) |
| Records | **2030** (2000 archived, 30 living) |
| Game days simulated | 453 |
| Commands issued | 365 |
| Problems found | **0** |
| Total run time | 15.1 s |

Bounded structures at the end, with 2030 records behind them:

| structure | value | limit |
|---|---:|---:|
| journal events | 45 | 63 |
| ledger entries | 100 | 100 |
| widest ancestor graph | 12 | 126 |
| deepest ancestor graph | 6 | 6 |

The ledger sitting exactly on its limit is the rolling window working: 365 commands wrote far more than 100 entries, and it never grew past the cap. The ancestor graph staying 12 wide after 151 generations is the repeated-ancestor rule from FS-404 doing its job — a lineage bred pair-by-pair has only two distinct ancestors per generation, and each is listed once rather than duplicated down every path.

Journal replay reproduced the world at the same revision and record count. A re-submitted command was absorbed without changing the record count or revision; a stale-revision command was refused.

## Finding — command cost grows with the record set

The soak's one real finding. `applyCommand` begins with `structuredClone(world)`, which is what guarantees the atomicity the architecture requires: a rejected command cannot leave fish, currency, capacity or sequence IDs half-changed. The price is that **every command copies every record**, including 2000 genomes of 60 loci × 2 phased copies.

Measured with bursts of `rename` — the cheapest real command there is, touching one fish — so the figure is copy cost and nothing else:

| records | ms per command |
|---:|---:|
| 806 | 22.5 |
| 830 | 24.3 |
| 854 | 26.1 |
| 1022 | 33.3 |
| 1262 | 45.8 |
| 1502 | 56.9 |
| 1766 | 73.3 |
| 2006 | **84.9** |

Early in the run, at roughly 80 records, a command cost **2.0 ms**. At 2006 records it costs **84.9 ms**.

The growth is close to proportional — 2.5× the records for 3.8× the cost — so this is the expected shape rather than a runaway, and the test pins it there. But the constant is large enough to matter: **renaming a fish in a 2000-record save takes about 85 ms**, which a player feels as a hitch on every action, and the schema permits five times that many records again.

This is not a leak — nothing grows that should not, and dropping the world frees it. It is a scaling cost that makes a long save progressively less responsive.

**Not fixed here.** The deep copy is the atomicity mechanism named in the architecture boundaries, and replacing it with structural sharing or copy-on-write is a change to the command layer, not a QA task. Recorded for a dedicated ticket; the cost curve above is the before-measurement it would be judged against.

## Limitations

- **The courtship path is not soaked.** The harness uses the instant `breed` cross, so `world.clutches` stays empty and clutch records never accumulate. Normal courtship needs each generation to reach adulthood at full condition, which is far too slow for 151 generations. The `pair`/`advanceClutches` path is covered instead by `tests/lifecycle.test.ts` and `src/core/unusualLineScenario.ts`; a clutch-heavy soak at full record count is still unmeasured.
- **One lineage shape.** Breeding pair-by-pair down a single chain keeps the ancestor graph narrow (12 of a possible 126). A broad pedigree with many unrelated founders would exercise the width bound harder, and does not.
- **No axolotls.** The soak breeds koi only, so species-boundary behaviour at scale is untested here.
- **Memory is inferred, not sampled.** The soak records wall-clock cost and structure sizes, not heap. A leak that showed only as retained bytes, without a growing structure, would not be caught.
- **Single process, no persistence layer.** IndexedDB, the writer lease and the two-backup recovery are not exercised; those belong to FS-703's migration, quota and crash matrix.

## Follow-ups

- **A dedicated ticket for command cost.** The candidate is copy-on-write or structural sharing in `applyCommand`, keeping the atomicity guarantee. Judge it against the curve above.
- **FS-703** should take the 2030-record world this harness produces as a fixture for its quota and crash tests; it is the largest valid world the project has produced so far.
- A clutch-heavy soak, and a broad-pedigree variant, would close the two coverage gaps named above.
