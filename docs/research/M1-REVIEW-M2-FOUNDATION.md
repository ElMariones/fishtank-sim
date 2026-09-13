# M1 review and M2 foundation

Recorded 13 September 2026. Genome v1, development v2, anatomy v2, renderer v3 remain unchanged. Runtime save schema v2 wraps world v1; this is not genome v2.

## M1 review (FS-107)

| Criterion | Evidence | Decision |
|---|---|---|
| Coherent anatomy at tested extremes | FS-102: 858-case comparison, zero attachment/framing failures under anatomy v2 | Pass for tested cases |
| Inherited marking signal | FS-103: sibling separation about 73%, up from 52% | Computational pass; human perception untested |
| Selection beyond founder range | FS-105: six traits, eight selected lines each beyond range by generation 10 | Pass; early saturation and pedigree F near 0.8 remain balance findings |
| Accessible lab interaction | FS-106 plus current keyboard/200% text/touch regression | Pass for recorded Chrome journeys |
| Larger lineage archive | FS-112: 10,000 stored records; 480 living cap; exact ancestry queries and 60-row pages | Pass for recorded fixtures |
| Human family recognition | No real observer records; FS-111 needs at least five people | Pending; do not claim the M1 gate passed |
| 100-generation renderability and appearance-version preservation | FS-702 soak and per-fish appearance versions are future work | Pending broader core-proof criteria |

The review is delivered; M1's perceptual release gate is still open. The user's request explicitly includes M2, so the deterministic persistence foundation proceeds while human research is pending. No shop, online market, care simulation or genome-v2 expansion was added.

## Resolved findings

The unfinished FS-112 branch proposed dropping ancestry older than 64 generations. The shipped query instead preserves exact recorded pedigree using an explicit stack and memoization, including diagonal terms. Sparse ancestor queries avoid allocating a matrix for every archived fish. Worst-case pair counts can still be quadratic and need later worker/caching work.

The original 10,000-record proposal assumed localStorage could reliably hold it. This release pairs that limit with IndexedDB transactions and two backups. The recorded 10,000-record runtime JSON is about 9 MB because it contains both current world and a replay checkpoint. Quota failures remain visible and recoverable; no universal storage-capacity guarantee is made.

Large archives and broad child lists now render 60 records at a time. Whole-collection search/filtering still finds records on every page. The save status is visible on phones as well as desktop.

## M2 delivered contracts

- **FS-201:** world-scoped monotonic command/event IDs, validated payloads, expected revision, integer 50 ms command ticks and deterministic replay. Exact recent retries have no effect; conflicting or compacted/stale retries reject. Checkpoints compact every 64 commands without resetting revision. The journal is bounded recovery history, not permanent life-event history.
- **FS-203:** serialized IndexedDB transactions rotate current and two valid snapshots, compare commit tokens, verify read-back and retain raw legacy data. Failed/aborted transactions preserve the entire recovery set. Unsupported data opens a temporary session with autosave blocked.
- **FS-204:** current/legacy export, file or paste import preview, explicit replacement, two-backup preview/restore and save retry. Malformed/future imports cannot overwrite the world. Goals/favorites remain device-local and the UI says so.

See [architecture](../ARCHITECTURE.md), ADR-022–025 in [decisions](../DECISIONS.md), and the exact runs in [testing](../TESTING.md#m1-continuation-and-m2-foundation-verification).

## Remaining M2 work

1. **FS-202:** move command/simulation work behind a versioned worker protocol; clean up start/stop/restart and StrictMode lifetimes; measure selection under a 200-fish synthetic workload. Current Canvas motion and replay validation still use the main thread.
2. **FS-205:** shared active/background integration and protected offline scheduler, negative clock/cap/event-boundary fixtures. Current tick is sampled at command commit, and no lifecycle or offline progression exists.
3. **FS-206:** proactive multi-tab writer lease, visible read-only takeover flow, worker-fault recovery and full quota handling rehearsal. Compare-and-swap currently prevents stale saves, but does not lock editing in the other tab.

M2's release gate is therefore pending. Physical crash/power-loss durability, other browsers, and 100-generation/production-scale soak remain unclaimed.
