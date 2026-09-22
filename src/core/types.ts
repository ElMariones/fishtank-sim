import type { CompetitionState } from './competitions';
import type { Decoration, TankStyle } from './tankManagement';
import type { AppearanceLocus } from './catalog';
import type { VisualDescriptorKey } from './descriptors';
import type { AxolotlGenome, AxolotlPhenotype } from './axolotlGenetics';
import type { AxolotlLocus } from './axolotlCatalog';

/** Genome v1 holds 48 loci per copy; genome v2 appends the 12 Color and Ornament loci (60); genome v3 the 6 Structure loci (66). */
export type Genome = { version: 1 | 2 | 3; maternal: number[]; paternal: number[] };
/** Species is explicit on persistent animals/clutches; koi keeps its historic genome byte shape while axolotls own a separate registry. */
export type Species = 'koi' | 'axolotl';
export type CreatureGenome = Genome | AxolotlGenome;
export type Mutation = {
  locus: number; copy: 'maternal' | 'paternal'; from: number; to: number;
  /** World v13 axolotl mutations persist their species-local stable locus ID; koi mutations intentionally omit it. */
  locusId?: AxolotlLocus;
};
/** A carried allele descended from a recorded mutation (FS-603): `id` names the fish, locus and copy where it arose. */
export type AlleleOrigin = { locus: number; copy: 'maternal' | 'paternal'; id: string };
/** Life model v1 state (FS-302). Age, size and condition accumulate on game-day boundaries; genetics only set the potential. */
export type LifeState = {
  model: 1;
  /** Whole game days since the egg was laid, counted at absolute day boundaries. */
  ageDays: number;
  /** Current body length in cm; 0 while still an egg. */
  lengthCm: number;
  /** Developmental condition 0–1: a moving average of recent environment, so deficits and recovery both take days. */
  condition: number;
};
/** Breeding model v1 state per fish (FS-401): whole game days until it can court again after spawning. */
export type BreedingState = { model: 1; cooldownDays: number };
export type Fish = {
  id: string; name: string; sex: 'F' | 'M'; species: Species; genome: CreatureGenome; birthSeed: number;
  generation: number; parents: [string, string] | null; bornAt: string;
  tankId: string; status: 'living' | 'sold' | 'rehomed'; mutations: Mutation[]; life: LifeState; breeding: BreedingState;
  /** Mutation origins this fish carries, by locus and copy (world v11). */
  origins: AlleleOrigin[];
};
/** Why a pairing is refused or a courtship is paused (FS-401). */
export type BlockerCode = 'role' | 'species' | 'unavailable' | 'immature' | 'condition' | 'cooldown' | 'busy' | 'apart' | 'water' | 'nursery-missing' | 'nursery-full' | 'nursery-busy' | 'limit';
export type ClutchStage = 'courting' | 'incubating' | 'hatched' | 'cancelled';
/**
 * Clutch record (FS-402). While courting it reserves `size` places in the nursery. When courtship completes those places
 * become tracked eggs with consecutive IDs from `firstFishId`. Records are kept after hatching as the clutch's history.
 */
export type Clutch = {
  id: string; motherId: string; fatherId: string;
  /** Species is frozen when courtship starts so delayed spawning and replay cannot reinterpret the cross. */
  species: Species;
  /** Tank where the pair started courting. */
  tankId: string;
  /** Tank that receives the eggs and holds the reservation until spawning. */
  nurseryId: string;
  size: number; genomeVersion: 1 | 2 | 3;
  /** Timestamp of the pairing command; eggs add completed deterministic game-day boundaries to it. */
  pairedAt: string;
  stage: ClutchStage;
  /** Whole game days since pairing. */
  days: number;
  /** Courtship progress 0–1. */
  progress: number;
  /** Blockers that paused courtship on the latest game day; empty while it progresses. */
  blockers: BlockerCode[];
  /** Value of `days` when the eggs were laid. */
  spawnedDay: number | null;
  firstFishId: string | null;
};
/** Water model v1 state for one tank (FS-301). Units are explicit; values are game approximations, not care advice. */
export type WaterState = {
  model: 1;
  /** Litres of water. */
  volumeL: number;
  /** Degrees Celsius. */
  temperatureC: number;
  /** Dissolved oxygen, mg O₂ per litre. */
  oxygenMgL: number;
  /** Total ammonia nitrogen proxy, mg N per litre. */
  ammoniaMgL: number;
  /** Uneaten food in grams. */
  foodG: number;
  /** Biofilter nitrification capacity at 20 °C, mg N per game day. */
  filterMgNPerDay: number;
  /** Aeration transfer coefficient (kLa), per game day. */
  aerationPerDay: number;
};
export type Ration = 'off' | 'light' | 'measured' | 'generous' | 'heavy';
/** Care model v1 state for one tank (FS-305). Equipment capacity lives on the water; settings and the feeding day live here. */
export type TankCare = {
  model: 1;
  /** Auto-feeder ration as a multiple of the residents' current food need. */
  ration: Ration;
  /** Thermostat setpoint, whole °C. Water temperature moves toward it at a bounded rate. */
  targetC: number;
  /** Food needed and eaten since the current game day began, grams. */
  dayNeedG: number;
  dayEatenG: number;
  /** Share of the residents' need eaten over the last completed game day, 0–1. */
  fed: number;
};
export type Tank = { id: string; name: string; capacity: number; planted: boolean; water: WaterState; care: TankCare; decorations?: Decoration[]; style?: TankStyle };
export type BuyerId = 'petShop' | 'longFin' | 'pondKeeper' | 'miniature' | 'colorCollector';
/** Economy model v1 NPC demand (FS-501): how many more fish each buyer will take; it recovers at game-day boundaries. */
export type MarketState = { model: 1; demand: Record<BuyerId, number> };
export type LedgerReason = 'sale' | 'stock' | 'equipment' | 'waterChange' | 'rehome' | 'competitionEntry' | 'competitionPrize' | 'competitionPurchase';
/** One credit change: `amount` is signed, `fish` counts the fish involved, `detail` is short readable text. */
export type LedgerEntry = { seq: number; reason: LedgerReason; amount: number; fish: number; detail: string };
/** Credits always equal `opening` plus every total; only the latest entries are kept. */
export type Ledger = { model: 1; opening: number; next: number; totals: Record<LedgerReason, number>; entries: LedgerEntry[] };
export type ListingCategory = 'founder' | 'variant' | 'carrier';
/** A shop specimen (FS-502): genome, sex and price are fixed from arrival until it is bought or leaves. */
export type Listing = {
  id: string; category: ListingCategory; name: string; sex: 'F' | 'M'; genome: Genome; birthSeed: number; price: number;
  /** Absolute game day at whose boundary the listing leaves the shop. */
  expiresDay: number;
  note: string;
  /** For documented carriers: the appearance locus and the variant allele carried as one hidden copy. */
  carries: { locus: AppearanceLocus; allele: number } | null;
};
export type ShopState = { model: 1 | 2; nextListing: number; refreshedDay: number; listings: Listing[] };
export type AxolotlListingCategory = 'founder' | 'morph' | 'carrier';
export type AxolotlSwitch = 'axo_leucistic_switch' | 'axo_albinism_switch' | 'axo_melanoid_switch';
/** An axolotl shop specimen (world v14): like a koi listing, fixed from arrival until it is bought or leaves. */
export type AxolotlListing = {
  id: string; category: AxolotlListingCategory; name: string; sex: 'F' | 'M'; genome: AxolotlGenome; birthSeed: number; price: number;
  expiresDay: number; note: string;
  /** For documented carriers: the recessive pigment switch and the severe allele carried as one hidden copy. */
  carries: { locus: AxolotlSwitch; allele: number } | null;
};
export type AxolotlShopState = { model: 1; nextListing: number; refreshedDay: number; listings: AxolotlListing[] };
/** How new fish are named: 1 numbered ("Fry 12"), 2 generated from name parts (ADR-055), 3 parts true to the fish's traits (ADR-056). */
export type NamingModel = 1 | 2 | 3;
/** A bloodline's standard (FS-604), taken from its foundation fish when it was registered and never changed after. */
export type BloodlineStandard = {
  /** Mean normalized visible descriptors of the foundation, 0–1. */
  descriptors: Record<VisualDescriptorKey, number>;
  tail: TailTopology; dorsal: DorsalForm; barbels: BarbelCount;
  /** Mutation origins every foundation fish carried. */
  signatureOrigins: string[];
};
export type Bloodline = { id: string; name: string; registeredAt: string; foundationIds: string[]; standard: BloodlineStandard };
/** No-money recovery (FS-504): koi rescues claimed so far and whole game days until the rescue can help again. */
export type ReliefState = { model: 1; claims: number; cooldownDays: number };
/**
 * World v2 added per-tank water (FS-301), v3 fish life state (FS-302), v4 tank care (FS-305), v5 breeding state and
 * clutches (FS-401/402), v6 NPC demand, a credit ledger and rehomed fish (FS-501), v7 persistent shop stock (FS-502),
 * v8 persisted decoration transforms (FS-503). World v9 adds the koi rescue (FS-504). World v10 (FS-601) accepts genome v3
 * records and shop model 2, which delivers genome v3 stock. World v11 (FS-603) adds mutation origins to every fish;
 * world v12 (FS-604) adds the bloodline registry. World v13 adds explicit species identity and the independent axolotl genome;
 * world v14 adds the persistent axolotl shop.
 * Older saves migrate with defaults.
 */
export type World = {
  version: 15; seed: number; nextId: number; nextClutchId: number; credits: number; fish: Fish[]; tanks: Tank[]; clutches: Clutch[];
  market: MarketState; ledger: Ledger; shop: ShopState; naming: NamingModel; relief: ReliefState;
  /** Registered bloodlines and the next registry number (world v12). */
  bloodlines: Bloodline[]; nextBloodlineId: number;
  /** Persistent axolotl stock (world v14), separate from the koi shop so koi deliveries never change. */
  axolotlShop: AxolotlShopState;
  circuit: CompetitionState;
};
/**
 * Development v2 inherited marking anchor, derived from one phased two-locus haplotype block.
 * Body coordinates: u 0 = snout tip … 1 = peduncle; v −1 = dorsal edge … 1 = ventral edge.
 */
export type MarkingAnchor = {
  key: string; block: number; alleles: [number, number]; origin: 'maternal' | 'paternal' | 'both';
  u: number; v: number; size: number; angle: number; layer: 'warm' | 'dark'; priority: number;
};
export type BaseColor = 'classic' | 'gold' | 'slate' | 'charcoal' | 'lavender' | 'jade';
export type AccentColor = 'classic' | 'crimson' | 'sunflower' | 'cobalt' | 'violet' | 'pearl';
export type DotColor = 'ink' | 'pearl' | 'gold' | 'turquoise' | 'ruby' | 'rainbow';
export type IrisColor = 'natural' | 'amber' | 'ruby' | 'sapphire' | 'emerald' | 'silver';
export type ScaleType = 'smooth' | 'fine' | 'mirror' | 'net' | 'pearl' | 'armor';
export type BodyMotif = 'spots' | 'stripes' | 'marble' | 'calico' | 'rosettes';
export type FinMotif = 'spots' | 'bands' | 'edge' | 'tips' | 'flame';
export type Motif<T extends string> = { kind: T; strength: number };
/**
 * Development v3 appearance from genome v2 chromosomes 9 (Color) and 10 (Ornament). Color lists hold one entry, or two
 * when different variants blend. Motif strength is 1 when homozygous and lower for carriers and mixes.
 */
export type Appearance = {
  base: BaseColor[]; accent: AccentColor[]; dots: DotColor[]; iris: IrisColor[];
  shimmer: number; scales: ScaleType;
  /** Opacity multiplier for the development v2 patches: 0 once two motif copies replace them. */
  patches: number;
  motifs: Motif<BodyMotif>[]; density: number; motifScale: number; contrast: number; reach: number;
  finMotifs: Motif<FinMotif>[];
};
export type TailTopology = 'standard' | 'paired' | 'crown';
export type DorsalForm = 'normal' | 'reduced' | 'absent';
export type BarbelCount = 0 | 2 | 4 | 6;
/**
 * Structure v1 from genome v3 chromosome 11 (FS-601). `lobeBalance` scales the upper lobes against the lower (0.8–1.3),
 * `spread` separates paired or crown lobes (0–1), and `rays` multiplies drawn fin rays (0.76–1.36).
 */
export type Structure = { tail: TailTopology; lobeBalance: number; spread: number; dorsal: DorsalForm; barbels: BarbelCount; rays: number };
export type Phenotype = {
  /** Absent means the historic koi phenotype. Axolotls carry their independent expressed phenotype alongside shared motion/life projections. */
  species?: 'axolotl'; axolotl?: AxolotlPhenotype;
  length: number; depth: number; taper: number; curve: number; head: number; snout: number;
  eye: number; eyePosition: number; iris: number; pupil: number; mouth: number; barbel: number;
  tail: number; spread: number; fork: number; dorsal: number; pectoral: number; finPigment: number;
  red: number; yellow: number; black: number; white: number; metallic: number; translucency: number;
  frequency: number; patternScale: number; warp: number; symmetry: number; edge: number; speckle: number;
  adultLengthCm: number; growth: number; longevity: number; metabolism: number; oxygen: number;
  fertility: number; speed: number; turning: number; activity: number; social: number; bold: number; curious: number;
  markings: MarkingAnchor[];
  appearance: Appearance;
  structure: Structure;
};
