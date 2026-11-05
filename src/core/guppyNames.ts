import { expressGuppy, type GuppyGenome } from './guppyGenetics';
import { hash, random } from './random';

/**
 * Guppy naming v1 (world v20): an independent vocabulary and RNG namespace, so koi, axolotl and goldfish names never
 * shift. Themed words are gated by expressed adult traits (strain, base color, tail, fins, size and behavior). The
 * vocabulary leans on where guppies come from (the streams of Trinidad and Venezuela), the carnival color of fancy
 * strains, jewels, and the naturalists who studied them.
 */
export const GUPPY_NAMING_MODEL = 1;
const ATTEMPTS = 48;
const MAX_LENGTH = 32;

type Tag =
  | 'female' | 'male' | 'red' | 'blue' | 'black' | 'albino' | 'golden' | 'blond' | 'moscow' | 'tuxedo' | 'snakeskin' | 'cobra' | 'metal'
  | 'spotted' | 'striped' | 'lace' | 'mosaic' | 'dumbo' | 'ribbon' | 'swallow' | 'sword' | 'delta' | 'endler' | 'iridescent'
  | 'small' | 'large' | 'bold' | 'shy' | 'active' | 'calm' | 'social' | 'forager' | 'showy';
type Pool = { when?: readonly Tag[]; prefixes?: readonly string[]; nouns?: readonly string[]; suffixes?: readonly string[] };
const list = (text: string) => text.split(',').map(word => word.trim()).filter(Boolean);

const POOLS: readonly Pool[] = [
  {
    prefixes: list('Little,Bright,Merry,Tiny,Quick,Sunny,Lively,Dapper,Jaunty,Spry,Rainbow,Carnival,Sparkly,Wee,Flashy'),
    nouns: list('Guppy,Millions,Poecilia,Aripo,Guanapo,Paria,Caroni,Yarra,Marianne,Tacarigua,Arima,Tobago,Calypso,Soca,Steelpan,Confetti,Sequin,Glitter,Spangle,Tinsel,Firefly,Minnow,Sprite,Pixie,Jitterbug,Zigzag,Ripple,Flick,Twinkle,Bauble,Button,Pebble,Pip,Gem,Jewel,Sparkle,Fizz,Zest,Lechmere,Winge,Haskins,Endler,Houde,Mango,Guava,Papaya,Tamarind,Hibiscus,Plantain,Cocoa'),
    suffixes: list('of the Aripo,of the Northern Range,of the Guanapo,of the Paria,of Port of Spain,the Bright,the Quick,the Dazzling,of Carnival,of the Hill Stream,the Lively,of the Rapids'),
  },
  { when: ['female'], prefixes: list('Lady,Madame,Duchess,Mama'), nouns: list('Matriarch,Ondine,Brood Queen,Pearl,Marigold,Dahlia,Ixora,Bougainvillea') },
  { when: ['male'], prefixes: list('Sir,Captain,Dandy,Lord'), nouns: list('Peacock,Dandy,Rogue,Romeo,Casanova,Swashbuckler,Troubadour,Bandleader') },
  { when: ['red'], prefixes: list('Crimson,Scarlet,Ruby,Flame-Tailed'), nouns: list('Ember,Cayenne,Paprika,Ruby,Hibiscus,Bonfire,Cherry'), suffixes: list('the Red') },
  { when: ['blue'], prefixes: list('Sapphire,Cobalt,Azure'), nouns: list('Sapphire,Lagoon,Indigo,Bluebird,Kingfisher'), suffixes: list('the Blue') },
  { when: ['black'], prefixes: list('Midnight,Velvet,Inky,Onyx'), nouns: list('Shadow,Licorice,Onyx,Raven,Nightjar'), suffixes: list('of the Night') },
  { when: ['albino'], prefixes: list('Ruby-Eyed,Rosy,Pale'), nouns: list('Blush,Petal,Rosewater,Coral') },
  { when: ['golden'], prefixes: list('Golden,Honeyed,Gilded'), nouns: list('Doubloon,Marigold,Honey,Sunbeam'), suffixes: list('the Golden') },
  { when: ['blond'], prefixes: list('Fair,Flaxen,Sandy'), nouns: list('Flax,Wheat,Sandbar,Biscuit') },
  { when: ['moscow'], prefixes: list('Moscow,Midnight-Blue,Velvet'), nouns: list('Tsar,Boyar,Matryoshka,Nightfall'), suffixes: list('of the Velvet Line') },
  { when: ['tuxedo'], prefixes: list('Dapper,Black-Tie,Formal'), nouns: list('Tuxedo,Maestro,Butler,Penguin,Conductor'), suffixes: list('in Tails') },
  { when: ['snakeskin'], prefixes: list('Serpent,Chainmail,Scaled'), nouns: list('Viper,Python,Chainmail,Basilisk'), suffixes: list('the Serpent') },
  { when: ['cobra'], prefixes: list('Royal,Hooded'), nouns: list('Cobra,Naga,Mamba'), suffixes: list('the King') },
  { when: ['metal'], prefixes: list('Chrome,Platinum,Silver-Headed'), nouns: list('Helmet,Bullet,Chrome Dome,Visor') },
  { when: ['spotted'], prefixes: list('Spotted,Dappled,Freckled'), nouns: list('Leopard,Ocelot,Domino,Polka') },
  { when: ['striped'], prefixes: list('Striped,Banded'), nouns: list('Tiger,Zebra,Humbug,Barcode') },
  { when: ['lace'], prefixes: list('Lacy,Filigree'), nouns: list('Doily,Lace,Filigree,Tatting') },
  { when: ['mosaic'], prefixes: list('Patchwork,Mosaic,Stained-Glass'), nouns: list('Mosaic,Quilt,Tessera,Kaleidoscope') },
  { when: ['dumbo'], prefixes: list('Big-Eared,Flappy'), nouns: list('Dumbo,Elephant,Jumbo,Flapjack') },
  { when: ['ribbon'], prefixes: list('Ribboned,Streaming'), nouns: list('Ribbon,Streamer,Pennant,Maypole') },
  { when: ['swallow'], prefixes: list('Swallow-Finned,Feathered'), nouns: list('Swallow,Swift,Plume,Quill') },
  { when: ['sword'], prefixes: list('Swordtailed,Dashing'), nouns: list('Cutlass,Rapier,Musketeer,Corsair,Sabre'), suffixes: list('the Swashbuckler') },
  { when: ['delta'], prefixes: list('Fan-Tailed,Billowing,Grand'), nouns: list('Delta,Fan,Sail,Banner,Cape,Peacock') },
  { when: ['endler'], prefixes: list('Wild,Tiny,Neon'), nouns: list('Endler,Campoma,Cumana,Firefly') },
  { when: ['iridescent'], prefixes: list('Shimmering,Iridescent,Opal'), nouns: list('Opal,Prism,Mother of Pearl,Aurora') },
  { when: ['small'], prefixes: list('Wee,Mini,Pocket'), nouns: list('Pip,Speck,Tiddler') },
  { when: ['large'], prefixes: list('Grand,Stout'), nouns: list('Big Mama,Whopper,Titan') },
  { when: ['showy'], prefixes: list('Flamboyant,Showboating'), nouns: list('Showstopper,Strutter,Peacock') },
  { when: ['bold'], prefixes: list('Brave,Bold,Plucky'), nouns: list('Rascal,Scamp,Daredevil') },
  { when: ['shy'], prefixes: list('Bashful,Timid'), nouns: list('Hush,Whisper') },
  { when: ['active'], prefixes: list('Zippy,Busy,Darting'), nouns: list('Zoom,Dash,Zip') },
  { when: ['calm'], prefixes: list('Dreamy,Placid'), nouns: list('Snooze,Drift') },
  { when: ['social'], prefixes: list('Friendly,Chummy'), nouns: list('Buddy,Pal') },
  { when: ['forager'], prefixes: list('Hungry,Nibbling'), nouns: list('Gobbler,Nibbler,Muncher') },
];

function tagsFor(sex: 'F' | 'M', genome: GuppyGenome): Set<Tag> {
  const p = expressGuppy(genome), male = sex === 'M', c = p.color, strain = p.strain.id, tags = new Set<Tag>([male ? 'male' : 'female']);
  const add = (tag: Tag, yes: boolean) => { if (yes) tags.add(tag); };
  add('albino', c.base === 'albino'); add('golden', c.base === 'golden'); add('blond', c.base === 'blond'); add('blue', c.base === 'blue' || strain === 'japan-blue');
  add('large', p.adultLengthCm >= (male ? 3.7 : 6)); add('small', p.adultLengthCm <= (male ? 2.6 : 4.2));
  add('bold', p.bold >= 0.72); add('shy', p.bold <= 0.22); add('active', p.activity >= 0.72); add('calm', p.activity <= 0.22);
  add('social', p.social >= 0.75); add('forager', p.behavior.foraging >= 0.78);
  add('dumbo', p.fins.dumbo > 0); add('ribbon', p.fins.ribbon > 0); add('swallow', p.fins.swallow > 0);
  if (!male) return tags;
  // Male color and tail words only: a female carries these programs hidden.
  add('red', strain === 'full-red' || c.redAmount > 0.7); add('black', strain === 'full-black'); add('moscow', strain === 'moscow'); add('tuxedo', strain === 'tuxedo');
  add('snakeskin', strain === 'snakeskin' || strain === 'king-cobra'); add('cobra', strain === 'king-cobra'); add('metal', strain === 'metal-head');
  add('spotted', strain === 'leopard'); add('striped', strain === 'tiger'); add('lace', strain === 'lace'); add('mosaic', strain === 'mosaic' || strain === 'grass');
  add('sword', ['top-sword', 'bottom-sword', 'double-sword', 'lyre'].includes(p.tail.shape)); add('delta', p.tail.shape === 'delta' || p.tail.shape === 'veil');
  add('endler', strain === 'endler'); add('iridescent', c.iriAmount > 0.8); add('showy', p.behavior.display >= 0.8);
  return tags;
}

/** Deterministic, unique-within-save guppy name. */
export function newGuppyName(key: string, sex: 'F' | 'M', genome: GuppyGenome, taken: Set<string>): string {
  const tags = tagsFor(sex, genome), pools = POOLS.filter(pool => (pool.when ?? []).every(tag => tags.has(tag))), themed = pools.filter(pool => pool.when?.length);
  let fallback = 'Guppy';
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const rng = random(hash(`guppy:${key}:name:${attempt}`));
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
