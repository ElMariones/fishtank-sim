import { expressGoldfish, type GoldfishGenome } from './goldfishGenetics';
import { hash, random } from './random';

/**
 * Goldfish naming v1: an independent vocabulary and RNG namespace, so koi and axolotl names never shift. Themed words are
 * gated by expressed adult traits (variety, color, eyes, hood, tail), leaning on the Chinese and Japanese breeding
 * traditions goldfish come from, lanterns, festivals and sweets.
 */
export const GOLDFISH_NAMING_MODEL = 1;
const ATTEMPTS = 48;
const MAX_LENGTH = 32;

type Tag =
  | 'female' | 'male' | 'red' | 'lemon' | 'white' | 'black' | 'calico' | 'bronze' | 'albino' | 'blue' | 'chocolate' | 'sarasa' | 'redcap' | 'panda'
  | 'telescope' | 'celestial' | 'bubble' | 'hood' | 'no-dorsal' | 'twin' | 'long-fin' | 'butterfly' | 'pearl' | 'pompon' | 'round' | 'slim'
  | 'large' | 'small' | 'bold' | 'shy' | 'active' | 'calm' | 'social' | 'forager' | 'metallic';
type Pool = { when?: readonly Tag[]; prefixes?: readonly string[]; nouns?: readonly string[]; suffixes?: readonly string[] };
const list = (text: string) => text.split(',').map(word => word.trim()).filter(Boolean);

const POOLS: readonly Pool[] = [
  {
    prefixes: list('Little,Lucky,Golden,Gentle,Bright,Merry,Plump,Sunny,Festival,Silken,Dancing,Paper,Happy,Tiny,Royal'),
    nouns: list('Kingyo,Jinyu,Wakin,Kinbu,Hanabi,Chochin,Mochi,Dango,Taiyaki,Yuzu,Kumquat,Lantern,Lotus,Koban,Ryo,Fortune,Biscuit,Nugget,Marmalade,Apricot,Tangerine,Clementine,Saffron,Butterscotch,Caramel,Pumpkin,Persimmon,Ember,Spark,Sunny,Doubloon,Penny,Fumi,Hoshi,Kiku,Momo,Ume,Ren,Sora,Mei,Lin,Bao,Fa,Xi,Fen,Goldie,Bubbles,Wiggles,Paddle,Ripple,Puff,Comet'),
    suffixes: list('of the Lantern Festival,of the Temple Pond,of the Summer Fair,of the Lotus Bowl,the Lucky,the Golden,the Plump,the Glorious,of Osaka,of Hangzhou,of Yatomi,the Merry'),
  },
  { when: ['female'], prefixes: list('Lady,Princess,Madame'), nouns: list('Hime,Sakura,Meili,Yuki,Hana,Lian,Peony,Camellia') },
  { when: ['male'], prefixes: list('Lord,Captain,Master'), nouns: list('Taro,Kenji,Wei,Bo,Jiro,Admiral,Bao') },
  { when: ['red'], prefixes: list('Crimson,Scarlet,Vermilion,Cinnabar'), nouns: list('Akai,Hong,Cherry,Ruby,Chili,Firecracker'), suffixes: list('the Red') },
  { when: ['lemon'], prefixes: list('Lemon,Honey,Buttercup'), nouns: list('Kiiro,Custard,Citrine,Mango'), suffixes: list('the Yellow') },
  { when: ['white'], prefixes: list('Snow,Pearl,Porcelain'), nouns: list('Shiro,Mochi,Daifuku,Rice Cake,Moonlight'), suffixes: list('the White') },
  { when: ['black'], prefixes: list('Velvet,Midnight,Inky,Ebony'), nouns: list('Kuro,Sumi,Moor,Ink,Licorice,Onyx'), suffixes: list('of the Night') },
  { when: ['calico'], prefixes: list('Calico,Confetti,Brocade'), nouns: list('Mikan,Mosaic,Patchwork,Kimono,Azuma'), suffixes: list('of Many Colors') },
  { when: ['bronze'], prefixes: list('Bronze,Wild,River,Olive'), nouns: list('Funa,Crucian,Brook,Reed,Mudlark'), suffixes: list('of the Paddy') },
  { when: ['albino'], prefixes: list('Rosy-Eyed,Pale'), nouns: list('Blossom,Petal,Peach') },
  { when: ['blue'], prefixes: list('Steel,Slate,Blue'), nouns: list('Aoi,Lan,Indigo,Slate') },
  { when: ['chocolate'], prefixes: list('Cocoa,Mocha'), nouns: list('Cocoa,Truffle,Chestnut,Hojicha') },
  { when: ['sarasa'], prefixes: list('Sarasa,Cloud-Patched'), nouns: list('Sarasa,Strawberry Milk,Koi Dream') },
  { when: ['redcap'], prefixes: list('Redcap,Crowned'), nouns: list('Tancho,Crane,Hinomaru') },
  { when: ['panda'], prefixes: list('Panda,Inkblot'), nouns: list('Panda,Domino,Oreo') },
  { when: ['telescope'], prefixes: list('Goggle-Eyed,Stargazing,Wide-Eyed'), nouns: list('Demekin,Dragon Eye,Goggles,Spyglass,Binoculars') },
  { when: ['celestial'], prefixes: list('Heaven-Gazing,Upward'), nouns: list('Chotengan,Stargazer,Astronomer,Skywatcher') },
  { when: ['bubble'], prefixes: list('Bubbly,Puffy'), nouns: list('Suihogan,Dumpling,Marshmallow,Water Balloon') },
  { when: ['hood'], prefixes: list('Crowned,Lion-Hearted,Wen-Headed'), nouns: list('Shishi,Raspberry,Lion,Chrysanthemum,Brainy'), suffixes: list('of the Crown') },
  { when: ['no-dorsal'], prefixes: list('Smooth-Backed'), nouns: list('Ranchu,Egg,Maruko,Pebble') },
  { when: ['twin'], prefixes: list('Twin-Tailed,Swishing'), nouns: list('Fantail,Ribbon,Kimono') },
  { when: ['long-fin'], prefixes: list('Flowing,Veiled,Trailing'), nouns: list('Veil,Silk,Streamer,Banner'), suffixes: list('the Flowing') },
  { when: ['butterfly'], prefixes: list('Butterfly,Moth-Winged'), nouns: list('Chocho,Butterfly,Origami') },
  { when: ['pearl'], prefixes: list('Pearly,Beaded'), nouns: list('Chinshurin,Golf Ball,Pearl,Ping Pong') },
  { when: ['pompon'], prefixes: list('Pompon,Tufted'), nouns: list('Hanafusa,Pompom,Tassel') },
  { when: ['round'], prefixes: list('Round,Chubby,Roly-Poly'), nouns: list('Dumpling,Bun,Meatball,Pudding') },
  { when: ['slim'], prefixes: list('Swift,Slender,Darting'), nouns: list('Arrow,Dart,Streak,Comet') },
  { when: ['large'], prefixes: list('Grand,Mighty'), nouns: list('Whale,Titan,Big Bao') },
  { when: ['small'], prefixes: list('Wee,Mini'), nouns: list('Bean,Pip,Sprat') },
  { when: ['metallic'], prefixes: list('Gleaming,Shining,Gilded'), nouns: list('Ingot,Coin,Sovereign') },
  { when: ['bold'], prefixes: list('Brave,Bold,Plucky'), nouns: list('Rascal,Scamp') },
  { when: ['shy'], prefixes: list('Bashful,Timid'), nouns: list('Hush,Whisper') },
  { when: ['active'], prefixes: list('Zippy,Busy'), nouns: list('Zoom,Dash') },
  { when: ['calm'], prefixes: list('Dreamy,Placid'), nouns: list('Snooze,Drift') },
  { when: ['social'], prefixes: list('Friendly'), nouns: list('Buddy,Pal') },
  { when: ['forager'], prefixes: list('Hungry,Rooting'), nouns: list('Gobbler,Muncher,Hoover') },
];

function tagsFor(sex: 'F' | 'M', genome: GoldfishGenome): Set<Tag> {
  const p = expressGoldfish(genome), tags = new Set<Tag>([sex === 'F' ? 'female' : 'male']), color = p.variety.color;
  const add = (tag: Tag, yes: boolean) => { if (yes) tags.add(tag); };
  add('red', color === 'Red'); add('lemon', color === 'Lemon'); add('white', color === 'White' || color === 'Platinum'); add('black', color === 'Black');
  add('calico', color === 'Calico' || color === 'Tri-color'); add('bronze', color === 'Bronze'); add('albino', color === 'Albino'); add('blue', color.startsWith('Blue'));
  add('chocolate', color.startsWith('Chocolate')); add('sarasa', color === 'Red and white'); add('redcap', color === 'Redcap'); add('panda', color === 'Panda');
  add('telescope', p.eyes.kind === 'telescope'); add('celestial', p.eyes.kind === 'celestial' || p.eyes.kind === 'skygazer'); add('bubble', p.eyes.bubble > 0);
  add('hood', p.head.hood > 0.3); add('no-dorsal', p.fins.dorsal === 'absent'); add('twin', p.tail.kind !== 'single'); add('long-fin', p.fins.long > 0);
  add('butterfly', p.tail.butterfly); add('pearl', p.scales.pearl > 0.5); add('pompon', p.head.pompon > 0); add('round', p.body.roundness > 0.72); add('slim', p.body.slim);
  add('large', p.adultLengthCm >= 26); add('small', p.adultLengthCm <= 13); add('metallic', p.scales.type === 'metallic' && p.scales.reflectivity > 0.85);
  add('bold', p.bold >= 0.72); add('shy', p.bold <= 0.22); add('active', p.activity >= 0.72); add('calm', p.activity <= 0.22);
  add('social', p.social >= 0.75); add('forager', p.behavior.foraging >= 0.78);
  return tags;
}

/** Deterministic, unique-within-save goldfish name. */
export function newGoldfishName(key: string, sex: 'F' | 'M', genome: GoldfishGenome, taken: Set<string>): string {
  const tags = tagsFor(sex, genome), pools = POOLS.filter(pool => (pool.when ?? []).every(tag => tags.has(tag))), themed = pools.filter(pool => pool.when?.length);
  let fallback = 'Kingyo';
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const rng = random(hash(`goldfish:${key}:name:${attempt}`));
    const pick = <T>(values: readonly T[]) => values[Math.min(values.length - 1, Math.floor(rng() * values.length))];
    const theme = themed.length > 0 && rng() < 0.6 ? pick(themed) : undefined, neutral = POOLS[0];
    const noun = pick(theme?.nouns?.length ? theme.nouns : neutral.nouns!), form = Math.floor(rng() * 4);
    const prefix = form === 1 || form === 3 ? pick(theme?.prefixes?.length ? theme.prefixes : neutral.prefixes!) : null;
    const suffix = form === 2 || form === 3 ? pick(theme?.suffixes?.length ? theme.suffixes : neutral.suffixes!) : null;
    const name = [prefix, noun, suffix].filter(Boolean).join(' ');
    const words = name.toLowerCase().split(/[\s-]+/);
    if (name.length > MAX_LENGTH || new Set(words).size !== words.length) continue;
    fallback = name;
    if (!taken.has(name)) { taken.add(name); return name; }
  }
  let n = 2, name = fallback;
  while (taken.has(name) && `${fallback} ${n}`.length <= MAX_LENGTH) name = `${fallback} ${n++}`;
  taken.add(name); return name;
}
