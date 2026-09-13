# Implementation status

**Updated:** 13 September 2026 · **Build:** 0.1.0 research lab · **M1:** FS-101 DONE (`fe138d4`); FS-102 DONE (`b0fd927`); FS-103 DONE (`bf4598b`); FS-104–107 open. User requests FS-108/FS-109 DONE (`621a3cb`).

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
- FS-102 anatomy v2: pure outline/anchor/bounds module shared by tank and portraits; eyes, fin roots, rays, gill and mouth attached to the measured outline; listed eye constraints; six anatomy stress fixtures; clipping-free fitted and shared-scale portraits; fish-shaped tank picking. See [FS-102 anatomy anchors](research/FS-102-ANATOMY-ANCHORS.md).
- FS-103 development v2 inherited markings: marking anchors from phased Pigments/Pattern haplotype blocks, birth-seed jitter only, renderer v3 body-space markings, an inspector list of each fish's marking blocks and their parental copy, and a seeded resemblance study (sibling separation 52% → 73%). See [FS-103 inherited markings](research/FS-103-INHERITED-MARKINGS.md).
- FS-108 (user request): larger colour-coded sex symbols (pink ♀, blue ♂) with visible or hidden text, on collection cards, the inspector, relatives, the batch review and parent pickers.
- FS-109 (user request): multi-select residents with shift-click ranges, select all and clear, a reviewed batch sale showing names, quotes and total, and one atomic `sell-batch` command.
- 32 automated tests (core, anatomy and pattern); production build; browser verification of representative interactions.

## Prototype shortcuts and limitations

| Area | Current limitation | Next task(s) |
|---|---|---|
| Visual quality | Canvas reference art; anatomy attachment and computed marking resemblance are measured, but no person has judged resemblance; portrait is static | FS-105–107 |
| Anatomy limits | An eye that cannot fit a shallow head is drawn smaller (adjustment listed); no protruding eyes or extra structures | FS-601–602 |
| Pattern inheritance | Placement inherited from haplotype blocks (73% sibling separation, computed); common haplotypes are shared by chance; ellipse shapes; symmetry is a spread proxy, not bilateral matching | FS-105 |
| Life stages | All fish display adult potential immediately; no aging, growth, hunger, health, death or lifespan integration | FS-302 |
| Behavior | No true feeding consumption, courtship, territorial utility, shelter use or learned memory | FS-303 |
| Curiosity/life-history genes | Some outputs are computed or displayed only; do not affect lifecycle | FS-302–303 |
| Breeding | Lab bypasses maturity, shared habitat, cost and cooldown; fixed 20 fish | FS-401–402 |
| Environment | No liters, biomass, temperature, water chemistry or oxygen simulation | FS-301 |
| Decorations | Plants are cosmetic toggle; no placement or collision footprint | FS-304 FS-503 |
| Economy | Free breeding/tanks make profit farming trivial, and batch sale makes it faster; stock is generated at purchase; no real market | FS-501–502 |
| Batch management | Batch sale only; no batch move/rehome, and selection does not persist across tank or archive views | FS-406 |
| Rarity | No measured reference population/global service or rarity badges | FS-603 FS-805 |
| Topology | No extra tail lobes/eyes/fins, scale geometry, or genome v2 | FS-601–602 |
| Family | One-hop navigation, no graph layout or lineage registration; matrix O(N²) | FS-404–405 FS-604 |
| History | Birth and pedigree stored; no append-only rename/move/sale journal or old portraits | FS-201 FS-404 |
| Appearance versions | Lab fish store no per-record development/anatomy/renderer version; all fish re-render under the current model (markings moved with development v2) | FS-404 FS-601 |
| Persistence | localStorage snapshots; no IndexedDB, import UI, migrations beyond v1, multi-tab lock or cloud sync | FS-203–206 |
| Save recovery | Invalid saved text preserved; temporary session can export, but full recovery UI pending | FS-204 |
| Performance | Main-thread motion; 60-per-tank/1000-record guardrails; no measured scale guarantee | FS-202 FS-701–702 |
| Selection | Body and caudal-fin shaped picking with 6 px slop; dorsal/pectoral fins only through slop; no animated camera travel | FS-106 |
| UI scale | Inspector stacks below collection on phones; long collections/relatives are not virtualized | FS-106 FS-404 |
| Offline | Motion pauses while hidden; no closed-browser/offline lifecycle | FS-205 |
| Online | No accounts, server, database, actual player listings, payments or external telemetry | M8 |
| Delivery | Pushed to GitHub `main`; no public deployment or continuous integration | FS-706 |

## Evidence

**FS-103, 13 September 2026, Windows 11, Node 22.18.0, npm 10.9.3:**

- npm test: **32 tests passed** (21 core, 5 anatomy, 6 pattern); strict typecheck passed.
- Seeded study, 24 families × 10 children: sibling separation 52.4% (independent placement) → 72.7% (inherited anchors); parent separation 53.3% → 71.9%; sibling overlap 21.1% → 41.8% against unrelated 19.3% → 28.9%. Replication at 60 × 12: 52.8% → 72.3%. FS-101 cohorts: 50.5% → 82.2%.
- Browser (in-app Chromium pane): Visual fixtures reports development v2 · anatomy v2 · renderer v3, "73% sibling marking separation" and the same two tables. Opening it added no console errors.

**FS-108/FS-109, same environment:**

- npm test: 26 tests passed; npm run build passed.
- Browser (in-app Chromium pane, its own device-local test world): bred Haru × Sumi to 26 residents. Sex symbols computed pink `rgb(255, 140, 198)` and blue `rgb(109, 185, 255)` at 21.6 px. Ticking Fry 7 and shift-ticking Fry 11 selected exactly five fish (◈ 401). The review listed their names, IDs, generations and quotes. Confirming raised credits 1,200 → 1,601 and residents 26 → 21 (sidebar 21 / 60), then cleared the selection and closed the review. The archive listed the five sold fish without checkboxes. No new console errors. At 375 × 812: no horizontal overflow, 40 px tall checkbox rows, inspector shows "♀ Female".

**FS-102, same environment:**

- npm test: 25 tests passed (20 core, 5 anatomy); npm run build passed.
- Anatomy sweep, 858 phenotypes: renderer v1 anchor rules failed for all 858 (286 eye overhangs, 243 stray tail rays, 26 clipped portraits, among others). Anatomy v2 failed 0 attachment and 0 framing checks; it limited 51 eye radii and moved 76 eyes.
- Browser: Visual fixtures rendered 0 / 858 anatomy failures, stress cards with listed adjustments, and the v1/v2 comparison table. After a clean reload no console errors were added; the only errors seen were Fast Refresh hook-dependency warnings raised while editing a mounted component.

**FS-101, 13 September 2026, Windows, Node 24.11.1, npm 11.6.2:** 20 tests and build passed. Browser: aquarium rendered; twenty offspring created; child renamed Ember; moved to Breeding Studio; Family selected Haru and focused The Koi Garden; Haru sold to local NPC and archived; reload retained fish counts and Ember's name/location; no console warnings/errors; 390 × 844 had no document overflow.

No production-scale benchmark, complete accessibility audit, external user study, online transaction test, or 100-generation visual study has been completed.

## Next action

**User request FS-110 (collection sex filter), then FS-104: cohort sorting and favorites.** FS-105 then needs both inherited markings and the comparison tools before running the selection report and resemblance study.
