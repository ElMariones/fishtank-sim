# FS-111 human resemblance study

**Status:** complete · **Observers:** 5 of 5 · **Trials:** 60 of 60 (20 per mode)  
**Trial set:** `study-v1-12x4` · genome v1 · development v2 · anatomy v2 · renderer v3

The user supplied five anonymous result records on 13 September 2026. The project stores answers and response times only; no name, account, device information or invented cue was added. Every score below was recomputed from the frozen trial answers rather than trusting the submitted summaries, which matched.

## Pooled result

| Mode | Correct | Accuracy | Wilson 95% interval | Above 50% chance |
|---|---:|---:|---:|---|
| Full appearance | 19 / 20 | 95% | 76.4–99.1% | Yes |
| Silhouette only | 20 / 20 | 100% | 83.9–100% | Yes |
| Markings only | 15 / 20 | 75% | 53.1–88.8% | Yes, narrowly |
| Overall | 54 / 60 | 90% | 79.9–95.3% | Yes |

| Observer | Full | Silhouette | Markings | Overall | Median response |
|---|---:|---:|---:|---:|---:|
| observer-001 | 4/4 | 4/4 | 3/4 | 11/12 | 7.6 s |
| observer-002 | 4/4 | 4/4 | 3/4 | 11/12 | 5.1 s |
| observer-003 | 4/4 | 4/4 | 3/4 | 11/12 | 3.4 s |
| observer-004 | 4/4 | 4/4 | 3/4 | 11/12 | 3.9 s |
| observer-005 | 3/4 | 4/4 | 3/4 | 10/12 | 3.1 s |

No record contained cue notes, so the acceptance criterion's cue report is: **none supplied**.

## Per-trial agreement

Every observer saw the same twelve trials, so agreement per trial is more informative than treating the 60 answers as independent. The computational columns repeat the FS-105 observer on each trial for the channel that mode actually shows.

| Trial | Mode | People correct | Computational silhouette | Computational markings |
|---|---|---:|---|---|
| trial-1 | Full | 5/5 | correct | correct |
| trial-2 | Silhouette | 5/5 | correct | hidden |
| trial-3 | Markings | 5/5 | hidden | correct |
| trial-4 | Full | 5/5 | correct | wrong |
| trial-5 | Silhouette | 5/5 | correct | hidden |
| trial-6 | Markings | 5/5 | hidden | correct |
| trial-7 | Full | 4/5 | correct | correct |
| trial-8 | Silhouette | 5/5 | correct | hidden |
| **trial-9** | **Markings** | **0/5** | hidden | correct |
| trial-10 | Full | 5/5 | correct | correct |
| trial-11 | Silhouette | 5/5 | correct | hidden |
| trial-12 | Markings | 5/5 | hidden | correct |

## Interpretation

1. **The human resemblance criterion passes for this trial set.** In every presentation mode, the lower 95% bound is above chance. People matched offspring to their parents by overall appearance and by body shape alone almost perfectly.
2. **Silhouette is the strongest cue; markings are the weakest.** All five markings misses came from one trial. On trial-9, the marking-overlap observer picks the true parents, so the placement signal exists, but every person chose the other pair. Without cue notes, the misleading feature is unknown. Candidates are pigment colour or amount rather than placement, or common haplotypes shared by chance (a known FS-103 limitation).
3. **Generalization is limited by trial count, not observer count.** Eleven of twelve trials had a correct majority (exact one-sided sign test over trials, p ≈ 0.003). Each mode still has only four distinct trials, so per-mode claims beyond `study-v1-12x4` need a second seeded trial set. Observers 1–4 gave identical answer patterns, which fits eleven near-unanimous trials but leaves little disagreement to analyze.
4. **Sample limits.** The user recruited observers informally. Familiarity with the project, colour vision, display and viewing conditions were not recorded.

## Follow-up, not blocking

- Before changing development v2 markings, show trial-9 again with a cue prompt, or add a second trial set with more markings trials and required cue notes.
- ADR-019's revisit trigger ("human study fails") was not met, so marking inheritance stays unchanged.

## Reproduction

The machine-readable pool is [`research/FS-111-OBSERVER-RESULTS.json`](../../research/FS-111-OBSERVER-RESULTS.json). `poolObserverRecords` validates unique observer IDs, all 12 unique trial IDs and the fixed trial-set identifier, then recomputes pooled scores, Wilson intervals and per-trial agreement. `npx vitest run tests/resemblancePool.test.ts` pins the result above.
