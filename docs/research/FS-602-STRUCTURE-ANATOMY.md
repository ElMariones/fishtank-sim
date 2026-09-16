# FS-602 — Tail topology, dorsal and barbel variants

**Date:** 17 September 2026. **Status:** DONE, pushed `0e95249`.
**Models:** anatomy v3 · renderer v7 · structure model 1 · genome v3 · world save v10. No save, command or genome change.

## Starting state

`e2c43cd` (FS-601 marked DONE) was HEAD and equal to `origin/main`. The baseline suite passed: 199 tests in 33 files.

## Scope

FS-602 asks for validated tail topology and barbel/dorsal variants, with reachable fixtures and no invalid geometry. GENETICS §8 sets two guardrails: a fixture must be reachable through permitted allele states, and no renderer exception may be keyed to a fish. §10 adds that anatomy validators must bound lobe counts and reject unsupported expression.

## Delivered

**Anatomy v3** (`src/core/anatomy.ts`) reads `phenotype.structure` from FS-601.
- **Tail lobes:** one lobe builder reproduces the anatomy v2 tail, with lobe balance and ray-pair count as parameters. A paired fan is two lobes at 62% spread, turned up and down about the shared caudal root by 0.18–0.48 rad as topology spread rises. A crown-four is four lobes at 92% length and 42% spread, at ±0.12–0.27 and ±0.42–0.77 rad. `caudal` is the first lobe and `extraLobes` holds the rest. Upper lobes scale by lobe balance and lower lobes by its complement. Ray roots stay inside the peduncle while each ray turns with its lobe.
- **Dorsal fin:** a reduced fin is 35% as tall and ends at 0.10 BL instead of 0.30. An absent fin is `null`.
- **Barbels:** 0, 2, 4 or 6. The anatomy v2 pair comes first, and further pairs are rooted a little behind it along the jaw, shorter and lower.
- **Fin rays:** density sets the ray pairs per half: three at baseline (seven rays), two to four on a standard tail, two or three on each paired or crown lobe.
- **Standard structure:** it takes exactly the anatomy v2 code path. Genome v1/v2 fish and genome v3 fish with baseline Structure alleles build geometry identical to anatomy v2. `tailBox` returns the anatomy v2 fin box for them, and picking uses the anatomy v2 test.

**Validation.** `validateAnatomy` now:
- accepts only 1, 2 or 4 lobes and 0, 2, 4 or 6 barbels;
- checks every lobe root, ray root and barbel root inside the body;
- checks each lobe in its own unrotated frame: tips behind the peduncle, notch before the tips, no folded lobe, ray ends on the trailing edge and ray bends inside the fin;
- keeps the bounds check covering every lobe at both tail-wave extremes.

**Renderer v7** (`src/rendering/fish.ts`). Every lobe joins one caudal path, filled, stroked and clipped once. Tail ornament, fin-tip gradients and flame rays use the box around all lobes, and rays are drawn for every lobe. An absent dorsal fin draws nothing and carries no dorsal pattern (`ornament.ts`). For a standard structure the draw calls are unchanged. Picking tests each turned lobe in its own frame, so a steep crown lobe can be clicked.

**Fixtures** (`src/core/visualFixtures.ts`, Visual fixtures → **Structure variants**). Twelve genome v3 fixtures on founder Kohaku, each validated by the registry:
- paired fan, and wide paired fan (dense rays, heavy upper lobes);
- crown, and tight crown (sparse rays, heavy lower lobes);
- a hidden carrier that looks standard;
- a lopsided standard tail;
- reduced and absent dorsal fins on a tall-finned body;
- no, four and six long barbels;
- a crown-four extreme on a long forked fan tail with no dorsal fin and six barbels.

`structureSweep` pairs every tail × dorsal × barbel form at both extreme shape settings with fixture bodies, seeded founders and all-A0/A5 bodies.

## Automated evidence

Windows 11, Node 22.18.0, npm 10.9.3. `npm run check`: **204 tests in 34 files** and the strict production build pass (main chunk 559.86 kB, 179.29 kB gzip, with Vite's size advisory).

`tests/structure.test.ts` (5 tests), with `tests/legacy/anatomyV2.ts` as a frozen copy of anatomy v2 from `fb6b593`:

| Fixture | Result |
|---|---|
| Anatomy v2 identity | 73 frozen fixtures (founders, cohorts, extremes, stress, appearance), 600 genome v2 founders, 300 all-A0/A5 v1 bodies and 200 genome v3 founders with baseline Structure. Each is checked adult, as a hatchling and half-grown: 3,519 anatomies deep-equal to anatomy v2 apart from the version and an empty `extraLobes`. Ornament for the 15 appearance fixtures equals the ornament built on the frozen anatomy |
| Fixtures | Lobe counts 2, 2, 4, 4, 1, 1 for paired, wide paired, crown, tight crown, carrier and lopsided. No dorsal is `null`, and a reduced dorsal is lower and shorter than the same body's normal fin. Barbels 0/2/4/6. Rays 7 on the wide paired lobe and 5 on the tight crown lobe. The lopsided upper lobe is longer and wider. Paired lobes turn up and down from one root, wider with more spread. Every fixture validates, portraits at 260×140 and 600×330 clip nothing, and picking hits the lowest lobe |
| Sweep | `structureSweep(120)`: more than 1,500 forms, 0 invalid and 0 clipped |
| Juvenile stages | Every fixture at body maturity 0, 0.25, 0.5 and 0.75 keeps its structure and validates |
| Reachability by breeding | Carriers of one paired-fan and one absent-dorsal copy look standard. With mutation off, 800 carrier × carrier children express each variant in 20–30% of births. Crown × paired gives only paired fans, and crown × crown only crowns |

Existing anatomy, juvenile, appearance and ornament tests pass unchanged.

## Browser evidence

In-app Chromium on the isolated `http://localhost:5183`.
1. **Visual fixtures:** **Structure variants** drew all 12 cards (12 canvases). The sweep note read "2256 tail, dorsal and barbel forms … · 0 invalid · 0 clipped portraits" (60 random bodies per source).
2. **Screenshots:** the paired fans fork up and down from the peduncle, the heavy-upper wide fan shows a larger upper lobe, and crowns fan four lobes. The carrier looks standard and the lopsided tail is longer above.
3. **Legibility fix:** on Kohaku's small dorsal fin and barbels the reduced dorsal and the barbel counts were hard to see. Those fixtures now add a tall dorsal fin or long barbels with valid v1 alleles, and the reduced fin reads as a small hump, the absent fin as a clean back, and four and six barbels as visibly more strands. The crown-extreme reads as a wide fan of narrow lobes.
4. **Swim path:** in the page, `drawFish` with motion drew every structure fixture adult and at 30% body maturity at four tail phases. All 96 draws completed and painted.
5. **Console:** no errors.

The pane's phone screenshots timed out repeatedly, so layout was not re-measured; the section uses the existing fixture grid.

## Remaining limits

- **No player fish shows structure yet:** founders almost never express it, so the live tank has not drawn a structural fish from a real lineage. FS-605's demonstration breeds one.
- **Art:** lobes are rigid turned copies of the anatomy v2 tail with the shared tail wave, not independently animated fins. A reduced dorsal fin reuses the dorsal curve.
- **Picking:** each lobe uses a cone approximation.
- **Scope:** pectoral topology, eye protrusion and scale geometry are still planned.
