# FS-303 behavior and requested breeding improvements

Recorded: 13 September 2026. FS-303, FS-114 and FS-115 DONE, pushed `e7aefc1`.

## Starting state

The remote branch and HEAD both pointed to 9f1a146 after fetching origin. Eight tracked files contained unfinished FS-303 changes; behavior.ts and behavior.test.ts were untracked. These were reviewed and completed in place. The unrelated .claude directory was left untouched and excluded from commits.

## Delivered

FS-303 adds a deterministic utility selector for cruise, forage, eat, hide and school, followed by steering. Hunger and fear are transient visual drives. Pellets sink, can be eaten once, and dissolve; feeding does not change nutrition, water, condition or persistent time. Clicking empty water startles nearby fish. Plants provide cover targets, not obstacle geometry. The selected fish's state, reasons and schooling leader are shown in the inspector. Protocol 2 transfers behavior arrays and pellet positions alongside transforms. Motion pauses when hidden and retains existing worker recovery/cleanup. Returning from another view no longer replays the last feed click.

The breeding planner supports 60 targets across shape, pigment, Genome 2 appearance and behavior, with up to four equally weighted goals. Each can seek higher/lower expression. Candidates can be searched by name/ID in all tanks or one tank; changing the filter preserves the chosen parents. Per-sex leaders and a use-both action rank eligible living, hatched candidates. Parent previews show adult trait match, home tank and individual goal values. Compound ranking expresses each candidate once per score, and candidate sorting is memoized separately from live behavior updates. The clutch destination and available places are explicit.

Categorical goals show target copies separately from visible expression. For each chosen categorical target, the planner reports exact marginal odds for at least one copy and two copies before mutation. These are not expression or joint probabilities. A blend may match both colors; hidden carriers may rank below an expressed fish. Recommendations rank parents individually, and do not optimize the pair's expected offspring or kinship. Pedigree F remains a separate displayed measure. No preview consumes a genetics random stream. Preferences remain device-local; old single-goal preferences still load.

All bulk selection, shift selection, review and confirmation exclude favorites and eggs. Adding a favorite during an open review removes it from that review immediately. Individual reviewed sales remain available. Fish records and ancestry are preserved.

Genome 2 inspection now names categorical alleles and intensity levels on each phased copy and explains dominance and hidden carriers. Ornament development 4 / renderer 5 adds irregular calico flecks with every inherited dot color, broken lobed rosettes, shaded armored plates and pearl-scale highlights. Genome v1 remains classic. Genome version, locus order, phase, mutation rules, founder frequencies, and saved genomes are unchanged. Existing v2 ornaments are redrawn under this visual revision; per-fish rendering versions remain future work. This is not a new genome schema or a human resemblance gate.

## Evidence

- npm run check: 101 tests, strict TypeScript and production build passed (final verification recorded in TESTING.md).
- Seven behavior fixtures cover all five desires, consumption, recovery from fear, dwell interruption, determinism and actor synchronization. Existing worker-client tests cover lifecycle/restart with protocol 2.
- New planner tests cover hidden copies vs visible color, blends, exact copy odds, opposing compound goals, preference reload and favorite/egg-safe atomic sales. Appearance regression covers the previously dropped second calico dot color. Existing v1 genetics/replay/resemblance pins and ornament bounds pass.
- In-app Chromium on isolated origin http://127.0.0.1:5174: combined gold-body plus long-tail goals selected Kohaku and Momo; copy odds showed 50% at least one gold copy, 0% two copies. Empty Breeding Studio yielded zero candidates while retaining the selected pair.
- In that disposable world, favoriting Haru reduced select-all to five; favoriting Sumi during review reduced it to four. Confirming sold four for 307 credits and left Haru and Sumi alive. Reload retained two goals and both favorites. Feeding showed Eating / hungry / food nearby in the inspector.
- Visual inspection covered the appearance gallery and desktop planner, plus 375 x 812 mobile layout with no horizontal overflow. The final fresh-load console was clean; one transient missing-export hot-reload error occurred between two source edits and resolved once both files were updated. The user's normal origin/save was not reset.

FS-304 spatial hash and obstacle geometry, FS-305 persistent feeding/care, FS-306 juvenile reveal and FS-307 integrated care demonstrations remain open. No health decay or mortality was introduced.
