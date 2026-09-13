# FS-113 appearance genetics

**Recorded:** 13 September 2026  
**Models:** genome v2 · development v3 · anatomy v2 · renderer v4. FS-101 to FS-111 research surfaces stay on genome v1.

## Request and decisions

The user asked for more appearance and gene variety: more base colors and eye colors, patterns beyond large low-opacity blobs (small multicolor dots, tiger stripes, mixes), more scale variety, patterns on the tail and dorsal fin, and chances for these features to appear.

The user chose two rules before implementation:

1. **Existing fish keep their exact look.** Stored genome v1 records are not rewritten.
2. **New features appear occasionally.** About one founder in four shows at least one; the striking variants stay well under 1%.

## What changed

- **Genome v2** appends chromosome 9 (Color) and chromosome 10 (Ornament): body color, accent color, dot color, eye color, shimmer, scale type, body motif, motif density, size, contrast, reach onto fins, and fin motif. The alleles, dominance rules and founder weights are in [genetics §7](../GENETICS.md#7-genome-v2-color-and-ornament-chromosomes-fs-113-implemented).
- **Inheritance** draws the new chromosomes from a separate derived stream. A seed's 48 v1 loci, mutation log and non-appearance phenotype are identical under genome v1 and v2. Genome v1 parents transmit the classic baseline, so their offspring look classic unless a new mutation appears.
- **Dominance** makes classic colors dominant and blends two different variants. A single body or fin motif copy shows faintly over the classic patches; two copies replace them, and two different motifs mix. Scale types are recessive, and rainbow dots are dominant.
- **Renderer v4** adds body palettes (gold, slate, charcoal, lavender, jade and blends); accent colors that recolor patches, warm fins and motifs; dot palettes including rainbow; and ruby, sapphire, emerald, amber, silver and two-tone eyes. It also draws five body motifs (fine spots, tiger stripes, marbling, calico flecks, rosettes), five scale types plus twinkling shimmer, and five tail and dorsal patterns (spots, bands, colored edges, dark tips, flame rays). Body motifs continue onto the tail and dorsal fin at high reach. Classic appearance uses the renderer v3 formulas unchanged.
- **Ornament geometry** is a pure core module in body-length units. The renderer builds batched `Path2D` objects once per phenotype and seed.
- **Inspector:** the Overview tab gains an Appearance block with founder-stock rarity ("uncommon", "rare", "very rare"). The Genome tab shows chromosomes 09–10, marked "not carried by genome v1" for older fish.
- **Visual fixtures** gain 15 appearance variants built on founder Kohaku's v1 loci, plus a 10,000-founder survey table.

## Founder survey

These are 10,000 seeded genome v2 founders, the distribution sold as unrelated stock. Figures are from the in-app Visual fixtures table (salt `fs-113:founders`). `tests/appearance.test.ts` asserts a separate seeded sample stays between 20% and 34%, with every striking variant under 1%.

| Feature | Founders showing it |
|---|---:|
| **At least one new feature** | **26.6%** |
| Body color | 2.5% |
| Accent color | 2.6% |
| Eye color | 3.1% |
| Shimmer | 3.6% |
| Scale type | 3.3% |
| Body pattern (including faint carriers) | 9.4% |
| Tail or dorsal pattern | 5.9% |
| Rosettes (striking) | 0.45% |
| Lavender body (striking) | 0.60% |
| Silver eyes (striking) | 0.35% |
| Jade body (striking) | 0.21% |
| Rainbow dots (striking) | 0.17% |
| Flame fins (striking) | 0.17% |
| Armored scales (striking) | 0.12% |
| Strong shimmer (striking) | 0.00% |

Strong shimmer needs about seven allele steps across both copies, so it is effectively a breeding target rather than a founder find.

## Compatibility evidence

- `npm run check`: 72 tests, strict TypeScript and production build passed.
- The FS-101 founder, cohort and extreme checksum pins, the FS-103 pattern thresholds, and the FS-105 selection and resemblance tests pass unchanged. So does the FS-111 pool, which uses the genome v1 `study-v1-12x4` trials.
- For 300 seeds, genome v2 founders share their first 48 loci with genome v1 founders. Genome v2 children of genome v1 parents match genome v1 children in v1 loci, v1 mutations and every non-appearance phenotype value.
- A world with genome v1 founders, genome v2 offspring and a genome v2 Newcomer round-trips through save validation. A short v2 genome, a long v1 genome and a mutation outside a v1 genome are rejected.
- All 15 appearance fixtures produce finite, deterministic ornament geometry within their anatomy bounds. The one color-only fixture correctly produces none.

## Save compatibility fix

Browser verification of an existing QA world found a blocking regression before push. That save's replay journal held breed and buy commands recorded by the genome v1 reducer. Replaying them under genome v2 produced 60-locus fish that no longer matched the stored snapshot, so the world opened in recovery mode ("Save snapshot does not agree with its replay journal").

Breed and buy commands now carry `genomeVersion`. The app sends 2; journal entries without it replay exactly as before, producing genome v1 children of genome v1 parents and genome v1 Newcomers. After the fix, the same world loaded and saved normally. `tests/appearance.test.ts` replays such a legacy journal and checks that its snapshot still decodes (ADR-034).

## Browser verification

In-app Chromium 152 against the local Vite server:

- **Appearance variants:** Visual fixtures rendered 15 cards and 15 portraits. A contact sheet of all 15 showed:
  - **Body patterns:** fine gold spots, tiger stripes, faint carrier stripes over patches, cobalt marbling, pearl and turquoise calico, rosettes on gold, and rainbow spots mixed with stripes.
  - **Colors, eyes and scales:** a slate body with crimson accents and ruby eyes; charcoal with pearl accents, silver eyes and netted scales; a lavender–jade blend with two-tone eyes and pearl scales; mirror scales with shimmer; and armored scales with sunflower accents.
  - **Fins:** banded tail and dorsal fins, colored fin edges with dark tips, and flame rays with ruby spots reaching the fins.
- **Founder survey:** the in-app table showed the 26.6% result above.
- **Existing QA world** (genome v1 fish and a legacy journal), after the fix:
  - The world loaded and saved. Haru's inspector read "Appearance · genome v1" with every trait classic, and the Genome tab marked chromosomes 09 and 10 "not carried by genome v1" (12 loci).
  - Four purchased Newcomers (107–110) were genome v2. Newcomer 110 showed a slate and lavender blended body, labeled very rare.
  - After a reload, the world loaded without a replay warning, and no console errors were recorded.

## Limitations

- Scale types are textures drawn on the 2D body, not scale geometry or topology.
- Rarity labels are exact founder-weight probabilities, not measurements of any player's population.
- Dot, stripe and fleck positions come from the birth seed. Family resemblance comes from inherited motif kind, colors, density, size and contrast. People have not tested this; FS-111 covered genome v1 only.
- Existing genome v1 lineages gain variety only through unrelated stock or new mutations (0.3% per transmitted copy per locus).
- The NPC sale quote ignores appearance.
- Ornament paths are cached per phenotype. Frame cost for a full tank of ornamented fish has not been profiled (FS-701).
