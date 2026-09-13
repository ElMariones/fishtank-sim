# Implementation status

**Updated:** 13 September 2026 · **Build:** 0.1.0 research lab · **FS-101:** DONE and pushed (`fe138d4`).

## Delivered

- Complete planning package: GDD, genetics, architecture, UX, balance, roadmap, task backlog, decision log and continuation guide.
- Original user concept preserved verbatim under docs/source.
- React/TypeScript/Vite app with pinned dependencies and runnable local scripts.
- Six deterministic founder koi with permanent world-local IDs, names, sex and birth timestamps.
- 48 loci on eight phased synthetic chromosomes; linked meiosis; adjacent allele mutation; recessive switches; polygenic expression.
- Parameter-driven body/head/snout/eye/mouth/barbel/fin/pigment/pattern drawing; same renderer in aquarium and portraits.
- Seeded initial positions, fixed-step wandering, local separation/cohesion, inherited speed/turning/activity/boldness and food attraction.
- Click/list selection, enlarged static adult preview, name editing, overview, all-locus view and mutation markers.
- Twenty-offspring instant crosses, repeat generations, parent references and mutation records.
- Clickable parents/children; living relatives focus their aquarium; sold fish remain readable.
- Pedigree kinship/F and locus heterozygosity as separate metrics.
- Multiple tanks, transfer, cosmetic plants on/off, resident search and local archive.
- Local NPC stock purchase, reviewed sale, bounded quote, and balance/ownership command checks.
- Device-local autosave, versioned schema/reference validation, preserved invalid save fallback and JSON export.
- Responsive desktop/phone layout, keyboard-accessible fish cards and reduced-motion initial pause.
- FS-101 visual baseline: deterministic founder/cohort/extreme fixtures, normalized descriptor report, accessible comparison surface, and downloadable JSON report.
- 20 automated core tests; production build; browser verification of representative interactions.

## Prototype shortcuts and limitations

| Area | Current limitation | Next task(s) |
|---|---|---|
| Visual quality | Canvas reference art; silhouettes/patterns need resemblance studies; portrait is static | FS-102–107 |
| Pattern inheritance | Parameters inherited, per-birth patch positions independent; symmetry is a spread proxy | FS-103 |
| Life stages | All fish display adult potential immediately; no aging, growth, hunger, health, death or lifespan integration | FS-302 |
| Behavior | No true feeding consumption, courtship, territorial utility, shelter use or learned memory | FS-303 |
| Curiosity/life-history genes | Some outputs are computed or displayed only; do not affect lifecycle | FS-302–303 |
| Breeding | Lab bypasses maturity, shared habitat, cost and cooldown; fixed 20 fish | FS-401–402 |
| Environment | No liters, biomass, temperature, water chemistry or oxygen simulation | FS-301 |
| Decorations | Plants are cosmetic toggle; no placement or collision footprint | FS-304 FS-503 |
| Economy | Free breeding/tanks make profit farming trivial; stock is generated at purchase; no real market | FS-501–502 |
| Rarity | No measured reference population/global service or rarity badges | FS-603 FS-805 |
| Topology | No extra tail lobes/eyes/fins, scale geometry, or genome v2 | FS-601–602 |
| Family | One-hop navigation, no graph layout or lineage registration; matrix O(N²) | FS-404–405 FS-604 |
| History | Birth and pedigree stored; no append-only rename/move/sale journal or old portraits | FS-201 FS-404 |
| Persistence | localStorage snapshots; no IndexedDB, import UI, migrations beyond v1, multi-tab lock or cloud sync | FS-203–206 |
| Save recovery | Invalid saved text preserved; temporary session can export, but full recovery UI pending | FS-204 |
| Performance | Main-thread motion; 60-per-tank/1000-record guardrails; no measured scale guarantee | FS-202 FS-701–702 |
| Selection | Approximate distance hit test; no precise fish-shaped picking or animated camera travel | FS-102 |
| UI scale | Inspector stacks below collection on phones; long collections/relatives are not virtualized | FS-106 FS-404 |
| Offline | Motion pauses while hidden; no closed-browser/offline lifecycle | FS-205 |
| Online | No accounts, server, database, actual player listings, payments or external telemetry | M8 |
| Delivery | Local files only; not committed/pushed or publicly deployed in this handoff | Future requested delivery action |

## Evidence

On Node 24.11.1, npm 11.6.2, Windows:

- npm test: **18 tests passed**.
- npm run build: strict TypeScript and Vite production bundle passed.
- Browser: aquarium renders; twenty offspring created; child renamed Ember; moved to Breeding Studio; Family selected Haru and focused The Koi Garden; Haru sold to local NPC and archived; reload retained fish counts and Ember’s name/location.
- Browser console: no warnings/errors observed in that verification.
- Phone viewport 390 × 844: tank, controls and breeding surface render; document has no horizontal overflow (tank selector intentionally scrolls).

No production-scale benchmark, complete accessibility audit, external user study, online transaction test, or 100-generation visual study has been completed.

## Next action

**FS-102: improve geometry anchors against the frozen fixture set.** The lab now has a reproducible visual baseline, but it is not evidence that the design’s hardest visual problem is solved.
