import { expressAxolotl, type AxolotlGenome } from './axolotlGenetics';
import { hash, random } from './random';

/** Axolotl naming v1: independent vocabulary and RNG namespace, so koi names never shift when this species is added. */
export const AXOLOTL_NAMING_MODEL = 1;
const ATTEMPTS = 48;
const MAX_LENGTH = 32;

type AxolotlNameTag =
  | 'female' | 'male' | 'leucistic' | 'albino' | 'melanoid' | 'axanthic' | 'golden' | 'pink' | 'dark'
  | 'speckled' | 'spotted' | 'mottled' | 'dappled' | 'marbled' | 'shimmer' | 'glassy'
  | 'large' | 'small' | 'long-gills' | 'full-gills' | 'long-tail' | 'big-head' | 'long-limbs'
  | 'bold' | 'shy' | 'active' | 'calm' | 'curious' | 'social';

type NamePool = { when?: readonly AxolotlNameTag[]; prefixes?: readonly string[]; nouns?: readonly string[]; suffixes?: readonly string[] };
const list = (text: string) => text.split(',').map(word => word.trim()).filter(Boolean);

/** The neutral pool deliberately differs from koi names and leans into salamanders, frills, caves, springs and Mexican flora. */
const POOLS: readonly NamePool[] = [
  {
    prefixes: list('Little,Velvet,Soft,Quiet,Misty,Mossy,Lunar,Secret,Tiny,Gentle,Ancient,Sunny,Silken,Dreamy,Lucky'),
    nouns: list('Xochi,Ambi,Nahui,Luma,Nixie,Frill,Frilly,Gilly,Axie,Sprig,Mossbud,Pebble,Cenote,Grotto,Spring,Rill,Reed,Fern,Lotus,Willow,Petal,Clover,Dewdrop,Minnow,Newt,Noodle,Bean,Button,Mochi,Pip,Pixel,Pogo,Miso,Taro,Yuzu,Chia,Cacao,Agave,Dahlia,Zinnia,Marigold,Opal,Mica,Quartz,Comet,Nebula,Orbit,Echo,Whisper,Ripple,Puddle,Brook,Drift,Bubble,Plume,Tassel,Coral,Ancho,Churro,Canela,Pepita,Elote,Lupita,Coco,Lola,Paco,Tito,Kiko,Nico'),
    suffixes: list('of the Grotto,of the Springs,of the Moss,of the Reeds,of the Moon,of the Cenote,of the Ferns,of the Shallows,the Soft,the Curious,the Unhurried,the Wiggly,the Frilled,the Tiny,the Gentle'),
  },
  { when: ['female'], prefixes: list('Lady,Doña'), nouns: list('Luna,Alma,Soleil,Maya,Flora,Lola,Lupita,Frida,Perla,Rosa') },
  { when: ['male'], prefixes: list('Señor,Sir'), nouns: list('Paco,Tito,Nico,Kiko,Milo,Otto,Bruno,Teo') },
  { when: ['leucistic'], prefixes: list('Pearl,Pale,Blush,Porcelain'), nouns: list('Milkglass,Pearl,Meringue,Cotton,Petal'), suffixes: list('the Pale,the Porcelain') },
  { when: ['albino'], prefixes: list('Rose-Eyed,Sunwashed,Golden-Pale'), nouns: list('Saffron,Vanilla,Apricot,Marzipan'), suffixes: list('of the Dawn') },
  { when: ['melanoid'], prefixes: list('Midnight,Inky,Obsidian,Velvet'), nouns: list('Inkstone,Onyx,Cinder,Shadow'), suffixes: list('of the Deep,the Dark') },
  { when: ['axanthic'], prefixes: list('Silver,Slate,Moonlit'), nouns: list('Graphite,Moonstone,Pewter'), suffixes: list('the Silver') },
  { when: ['golden'], prefixes: list('Golden,Honey,Amber'), nouns: list('Nectar,Sunbeam,Topaz'), suffixes: list('of the Sun') },
  { when: ['pink'], prefixes: list('Rosy,Blushing,Coral'), nouns: list('Peony,Guava,Dragonfruit'), suffixes: list('the Rosy') },
  { when: ['dark'], prefixes: list('Dusky,Smoky,Charcoal'), nouns: list('Soot,Basalt,Inkcap') },
  { when: ['speckled'], prefixes: list('Speckled,Peppered,Freckled'), nouns: list('Freckles,Poppyseed,Confetti') },
  { when: ['spotted'], prefixes: list('Spotted,Dapple-Dot'), nouns: list('Polka,Dot,Domino') },
  { when: ['mottled'], prefixes: list('Mottled,Patchy'), nouns: list('Mosaic,Patchwork') },
  { when: ['dappled'], prefixes: list('Dappled,Clouded'), nouns: list('Dapple,Cloudlet') },
  { when: ['marbled'], prefixes: list('Marbled,Swirled'), nouns: list('Marble,Agate,Swirl') },
  { when: ['shimmer'], prefixes: list('Iridescent,Glimmering,Starry'), nouns: list('Glimmer,Stardust,Prism,Mica'), suffixes: list('the Shimmering') },
  { when: ['glassy'], prefixes: list('Glassy,Crystal,Translucent'), nouns: list('Crystal,Wisp,Quartz') },
  { when: ['large'], prefixes: list('Grand,Big,Jumbo'), nouns: list('Goliath,Titan') },
  { when: ['small'], prefixes: list('Mini,Tiny,Little'), nouns: list('Pip,Button,Pea') },
  { when: ['long-gills'], prefixes: list('Plumed,Feathery,Long-Frilled'), nouns: list('Plume,Tassel,Feather'), suffixes: list('the Plumed') },
  { when: ['full-gills'], prefixes: list('Fluffy,Full-Frilled'), nouns: list('Pompon,Ruff') },
  { when: ['long-tail'], prefixes: list('Longtail,Ribbon-Tailed'), nouns: list('Ribbon,Streamer') },
  { when: ['big-head'], prefixes: list('Broadhead,Big-Headed'), nouns: list('Buttonhead') },
  { when: ['long-limbs'], prefixes: list('Long-Legged,Stilt-Legged'), nouns: list('Stilts,Strider') },
  { when: ['bold'], prefixes: list('Brave,Bold,Daring'), nouns: list('Scout,Rascal') },
  { when: ['shy'], prefixes: list('Bashful,Timid,Quiet'), nouns: list('Shylo,Whisper') },
  { when: ['active'], prefixes: list('Zippy,Busy,Restless'), nouns: list('Scoot,Dash,Wiggle') },
  { when: ['calm'], prefixes: list('Still,Mellow,Placid'), nouns: list('Dozer,Drift') },
  { when: ['curious'], prefixes: list('Curious,Nosy,Questing'), nouns: list('Snoop,Explorer') },
  { when: ['social'], prefixes: list('Friendly,Companionable'), nouns: list('Buddy,Pal') },
];

export function axolotlNameTags(sex: 'F' | 'M', genome: AxolotlGenome): Set<AxolotlNameTag> {
  const p = expressAxolotl(genome), tags = new Set<AxolotlNameTag>([sex === 'F' ? 'female' : 'male']);
  const add = (tag: AxolotlNameTag, yes: boolean) => { if (yes) tags.add(tag); };
  add('leucistic', p.pigmentation.morph === 'leucistic-like');
  add('albino', p.pigmentation.morph === 'albino-like');
  add('melanoid', p.pigmentation.morph === 'melanoid-like');
  add('axanthic', p.pigmentation.morph === 'axanthic-like');
  add('golden', p.pigmentation.xanthophore > 0.72 && p.pigmentation.melanin < 0.5);
  add('pink', p.pigmentation.bodyColor.h < 25 || p.pigmentation.bodyColor.h > 330);
  add('dark', p.pigmentation.melanin > 0.76);
  for (const mode of p.pattern.modes) if (mode !== 'plain') tags.add(mode);
  add('shimmer', p.pigmentation.iridescence > 0.58);
  add('glassy', p.pigmentation.translucency > 0.48);
  add('large', p.adultLengthCm >= 29); add('small', p.adultLengthCm <= 20);
  add('long-gills', p.morphology.gills.stalkLength >= 0.19);
  add('full-gills', p.morphology.gills.branchCount >= 12);
  add('long-tail', p.morphology.tail.length >= 0.72);
  add('big-head', p.morphology.head.width >= 0.35);
  add('long-limbs', p.morphology.limbs.foreLength >= 0.21 || p.morphology.limbs.hindLength >= 0.24);
  add('bold', p.bold >= 0.72); add('shy', p.bold <= 0.22);
  add('active', p.activity >= 0.72); add('calm', p.activity <= 0.22);
  add('curious', p.curious >= 0.72); add('social', p.social >= 0.72);
  return tags;
}

const eligible = (tags: ReadonlySet<AxolotlNameTag>) => POOLS.filter(pool => (pool.when ?? []).every(tag => tags.has(tag)));

/** Deterministic, unique-within-save axolotl name. Every themed word is gated by an expressed adult trait. */
export function newAxolotlName(key: string, sex: 'F' | 'M', genome: AxolotlGenome, taken: Set<string>): string {
  const tags = axolotlNameTags(sex, genome), pools = eligible(tags), themed = pools.filter(pool => pool.when?.length);
  let fallback = 'Axie';
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const rng = random(hash(`axolotl:${key}:name:${attempt}`));
    const pick = <T>(values: readonly T[]) => values[Math.min(values.length - 1, Math.floor(rng() * values.length))];
    const useTheme = themed.length > 0 && rng() < 0.58, theme = useTheme ? pick(themed) : undefined;
    const neutral = POOLS[0], nounPool = theme?.nouns?.length ? theme.nouns : neutral.nouns!;
    const noun = pick(nounPool), form = Math.floor(rng() * 4);
    const prefixPool = theme?.prefixes?.length ? theme.prefixes : neutral.prefixes!;
    const suffixPool = theme?.suffixes?.length ? theme.suffixes : neutral.suffixes!;
    const prefix = form === 1 || form === 3 ? pick(prefixPool) : null;
    const suffix = form === 2 || form === 3 ? pick(suffixPool) : null;
    const name = [prefix, noun, suffix].filter(Boolean).join(' ');
    if (name.length > MAX_LENGTH || new Set(name.toLowerCase().split(/[\s-]+/)).size !== name.toLowerCase().split(/[\s-]+/).length) continue;
    fallback = name;
    if (!taken.has(name)) { taken.add(name); return name; }
  }
  let n = 2, name = fallback;
  while (taken.has(name) && `${fallback} ${n}`.length <= MAX_LENGTH) name = `${fallback} ${n++}`;
  taken.add(name); return name;
}
