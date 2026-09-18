import { SHIMMER_VISIBLE } from './appearance';
import { express } from './genetics';
import { isAxolotlGenome } from './axolotlGenetics';
import { newAxolotlName } from './axolotlNames';
import { hash, random } from './random';
import type { AccentColor, BaseColor, BodyMotif, DotColor, FinMotif, Fish, IrisColor, NamingModel, Phenotype, ScaleType, World } from './types';

/**
 * Naming model 3 (ADR-056): a new fish gets a readable name of one, two or three parts, a noun alone or with a prefix
 * and/or a suffix, and every part is true of the fish. Words that claim a color, pattern, size, shape, behavior or sex
 * belong to a group that requires that trait, so a jade fish can be "Matcha" or "Jade the Jaded" but never "Golden",
 * and only a striped fish is a "Tiger". About half of the fish that show a nameable trait get one part about it; the rest
 * use neutral words. Names that are already in use reroll. Names are mutable text: they never feed genetics, prices or
 * identity.
 */
export const NAMING_MODEL = 3 satisfies NamingModel;
export const MAX_NAME_LENGTH = 32;
/** Share of names given one trait part, when the fish has any nameable trait. */
export const THEMED_SHARE = 0.5;
const ATTEMPTS = 32;

export type NameTag =
  | 'female' | 'male'
  | `body:${Exclude<BaseColor, 'classic'>}` | 'pale' | `accent:${Exclude<AccentColor, 'classic'> | 'orange'}` | 'inkPatches'
  | `dots:${DotColor}` | `motif:${BodyMotif}` | `fins:${FinMotif}` | `eyes:${Exclude<IrisColor, 'natural'>}` | `scales:${Exclude<ScaleType, 'smooth'>}`
  | 'sparkle' | 'dazzle' | 'metallic' | 'glassy'
  | 'huge' | 'big' | 'small' | 'tiny' | 'longTail' | 'shortTail' | 'round' | 'slim' | 'whiskers' | 'bigEyes'
  | 'fast' | 'slow' | 'agile' | 'hungry' | 'active' | 'calm' | 'bold' | 'shy' | 'social' | 'loner' | 'curious' | 'incurious';

/** Where a trait becomes nameable. Thresholds sit near the founder-stock tenth and ninetieth percentiles or beyond. */
export const NAME_THRESHOLDS = {
  /** Classic patch strength as drawn: pigment × opacity × patch visibility. */
  patches: 0.45, plainPatches: 0.3,
  /** A classic body this white and this little yellow, with faint patches and no motif, reads pale. */
  paleWhite: 0.55, paleYellow: 0.55,
  /** The classic accent reads orange between these yellow levels (hue about 16–38°). */
  orangeYellow: [0.15, 0.85],
  /** Fins are filled with the accent color above this pigment, as the renderer draws them. */
  finPigment: 0.55,
  dazzle: 0.7, metallic: 0.35, glassy: 0.24,
  /** Adult length potential, cm. */
  huge: 72, big: 62, small: 42, tiny: 36,
  longTail: 0.55, shortTail: 0.22, round: 0.43, slim: 0.22, whiskers: 0.14, bigEyes: 0.046,
  hungry: 1.25, agile: 1.68, fast: 0.052, slow: 0.033,
  /** Inherited tendencies, shown 0–100 in the inspector: 70 or more is high, 20 or less is low. */
  high: 0.65, low: 0.25,
} as const;

/** The traits a fish's name may mention, from its sex and expressed adult phenotype. */
export function nameTags(sex: Fish['sex'], p: Phenotype): Set<NameTag> {
  const t = NAME_THRESHOLDS, a = p.appearance, tags = new Set<NameTag>([sex === 'F' ? 'female' : 'male']);
  const add = (tag: NameTag, when: boolean) => { if (when) tags.add(tag); };
  const motif = (kind: BodyMotif) => a.motifs.some(entry => entry.kind === kind), fin = (kind: FinMotif) => a.finMotifs.some(entry => entry.kind === kind);
  const opacity = (1 - p.translucency) * a.patches, warm = p.red * opacity, dark = p.black * opacity;
  // A color is named only when one variant is expressed: a blend mixes hues and matches neither name.
  if (a.base.length === 1 && a.base[0] !== 'classic') tags.add(`body:${a.base[0]}`);
  add('pale', a.base[0] === 'classic' && p.white >= t.paleWhite && p.yellow <= t.paleYellow && warm < t.plainPatches && dark < t.plainPatches && !a.motifs.length);
  // The accent color must actually be drawn: warm patches, colored fins, or a motif or fin pattern painted in it.
  const accentShows = warm >= t.patches || p.finPigment > t.finPigment || motif('marble') || motif('calico') || motif('rosettes')
    || fin('edge') || fin('flame') || (motif('stripes') && p.black < 0.08);
  if (accentShows && a.accent.length === 1) {
    if (a.accent[0] !== 'classic') tags.add(`accent:${a.accent[0]}`);
    else add('accent:orange', p.yellow >= t.orangeYellow[0] && p.yellow <= t.orangeYellow[1]);
  }
  add('inkPatches', dark >= t.patches);
  if ((motif('spots') || motif('calico') || fin('spots')) && a.dots.length === 1) tags.add(`dots:${a.dots[0]}`);
  for (const entry of a.motifs) tags.add(`motif:${entry.kind}`);
  for (const entry of a.finMotifs) tags.add(`fins:${entry.kind}`);
  if (a.iris.length === 1 && a.iris[0] !== 'natural') tags.add(`eyes:${a.iris[0]}`);
  if (a.scales !== 'smooth') tags.add(`scales:${a.scales}`);
  add('sparkle', a.shimmer >= SHIMMER_VISIBLE); add('dazzle', a.shimmer >= t.dazzle);
  add('metallic', p.metallic >= t.metallic); add('glassy', p.translucency >= t.glassy);
  add('huge', p.adultLengthCm >= t.huge); add('big', p.adultLengthCm >= t.big);
  add('small', p.adultLengthCm <= t.small); add('tiny', p.adultLengthCm <= t.tiny);
  add('longTail', p.tail >= t.longTail); add('shortTail', p.tail <= t.shortTail);
  add('round', p.depth >= t.round); add('slim', p.depth <= t.slim);
  add('whiskers', p.barbel >= t.whiskers); add('bigEyes', p.eye >= t.bigEyes);
  add('hungry', p.metabolism >= t.hungry); add('agile', p.turning >= t.agile);
  add('fast', p.speed >= t.fast); add('slow', p.speed <= t.slow);
  add('active', p.activity >= t.high); add('calm', p.activity <= t.low);
  add('bold', p.bold >= t.high); add('shy', p.bold <= t.low);
  add('social', p.social >= t.high); add('loner', p.social <= t.low);
  add('curious', p.curious >= t.high); add('incurious', p.curious <= t.low);
  return tags;
}

type Slot = 'prefixes' | 'nouns' | 'suffixes';
const SLOTS: readonly Slot[] = ['prefixes', 'nouns', 'suffixes'];
/** Words usable only when the fish has every tag in `when`. `themed` groups describe a trait other than sex. */
export type NameGroup = { when: readonly NameTag[]; themed: boolean } & Record<Slot, readonly string[]>;
const words = (text = '') => text.split(',').map(entry => entry.trim()).filter(Boolean);
function group(when: NameTag | readonly NameTag[] | null, parts: Partial<Record<Slot, string>>): NameGroup {
  const tags = when === null ? [] : typeof when === 'string' ? [when] : when;
  return { when: tags, themed: tags.some(tag => tag !== 'female' && tag !== 'male'), prefixes: words(parts.prefixes), nouns: words(parts.nouns), suffixes: words(parts.suffixes) };
}

/** The first group is neutral: none of its words describe how a fish looks or behaves. */
export const NAME_GROUPS: readonly NameGroup[] = [
  group(null, {
    prefixes: `Captain, Admiral, Commodore, Major, Colonel, General, Sergeant, Professor, Doctor, Chef, Judge, Mayor, Sheriff,
      Skipper, Bosun, Maestro, Sensei, Regent, Consul, Chancellor, Agent, Coach, Pilot, Saint, Grand, Lucky, Merry, Jolly, Happy,
      Grumpy, Cheeky, Sneaky, Gentle, Noble, Humble, Clever, Wise, Silly, Dizzy, Fancy, Dapper, Proud, Wild, Zesty, Spicy,
      Sweet, Salty, Sassy, Bubbly, Dreamy, Patient, Loyal, Royal, Secret, Mystic, Cosmic, Lunar, Solar, Astral, Lost, Singing,
      Humming, Whistling, Giggling, Gliding, Rainy, Windy, Moony, Summer, Morning, Evening, Northern, Southern, Eastern,
      Western, Coastal, Tidal, Briny, Deepwater, Snazzy, Jazzy, Groovy, Grumbly, Gallant, Jaunty, Chipper, Quirky, Witty, Zany,
      Breezy, Cozy`,
    nouns: `Biscuit, Muffin, Waffle, Pancake, Crumpet, Pretzel, Cookie, Cupcake, Nougat, Marzipan, Sorbet, Gelato, Pudding,
      Tapioca, Ramen, Udon, Soba, Sushi, Dango, Churro, Taco, Nacho, Burrito, Gnocchi, Ravioli, Macaroni, Tortellini, Risotto,
      Paella, Falafel, Hummus, Kebab, Samosa, Chutney, Masala, Bonbon, Jellybean, Gumdrop, Lollipop, Bagel, Scone,
      Flicker, Nova, Quasar, Pulsar, Orbit, Eclipse, Zenith, Galaxy, Cosmos, Thunder, Lightning, Drizzle, Breeze, Gale, Tempest,
      Cyclone, Monsoon, Dewdrop, Raindrop, Puddle, Ripple, Wave, Tide, Eddy, Whirlpool, Riptide, Lagoon, Reef, Atoll, Shoal,
      Cove, Harbor, Delta, Brook, Creek, Rivulet, Cascade, Rapids, Fountain, Geyser, Cobble,
      Bramble, Briar, Juniper, Willow, Birch, Aspen, Cedar, Cypress, Maple, Rowan, Alder, Hemlock, Sequoia, Lotus, Lily, Tulip,
      Dahlia, Camellia, Tsubaki,
      Bubbles, Splash, Sploosh, Plop, Drip, Fin, Finn, Gill, Scales, Snapper, Guppy, Tetra, Molly, Platy, Danio, Loach, Pleco,
      Gourami, Betta, Oscar, Discus, Goby, Blenny, Wrasse, Tang, Grouper, Marlin, Tuna, Trout, Carp, Pike, Perch, Bass, Haddock,
      Herring, Sardine, Anchovy, Mackerel, Halibut, Flounder, Sturgeon, Barracuda, Seahorse, Starfish, Urchin, Anemone,
      Nautilus, Squid, Octopus, Prawn, Clam, Mussel, Oyster, Scallop, Conch, Limpet, Barnacle, Driftwood, Lantern, Anchor,
      Compass, Sextant, Buoy, Rudder, Paddle, Oar, Sail, Mast, Galleon, Dinghy, Schooner, Canoe, Kayak,
      Dragon, Wyvern, Griffin, Selkie, Goblin, Gremlin, Golem, Oracle, Wizard, Druid, Bard, Knight, Paladin, Ranger, Rogue,
      Pirate, Corsair, Buccaneer, Viking, Samurai, Ronin, Ninja, Shinobi, Nomad, Pilgrim, Voyager, Rover, Dreamer, Jester,
      Minstrel, Juggler, Tinker, Cobbler, Baker, Potter, Weaver, Miller, Fletcher, Archer, Gambit, Rascal, Scamp, Rebel, Bandit,
      Outlaw, Zephyr, Echo, Riddle, Puzzle, Enigma, Cipher, Rune, Sigil, Talisman, Amulet, Trinket, Bauble, Yoyo, Kite,
      Whistle, Trumpet, Tuba, Banjo, Ukulele, Fiddle, Piccolo, Oboe, Cello, Harp, Lute, Sitar, Bongo, Maraca, Cymbal,
      Tambourine, Kazoo, Melody, Harmony, Sonata, Ballad, Lullaby, Jingle, Tango, Salsa, Samba, Rumba, Waltz, Bolero,
      Mambo, Boogie, Opera, Hikari, Kaede, Kai, Rin, Kumo, Tsuki, Neko, Asahi, Hibiki, Ziggy, Bingo, Kip, Bix, Zuzu`,
    suffixes: `the Wise, the Grand, the Gentle, the Clever, the Lucky, the Unlucky, the Patient, the Dreamer, the Navigator,
      the Lost, the Found, the Glorious, the Graceful, the Dapper, the Silent, the Merry, the Jolly, the Grumpy, the Humble,
      the Proud, the Noble, the Kind, the Just, the Unready, the Relentless, the Invincible, the Legendary, the Eternal,
      the Dashing, the Charming, the Sly, the Crafty, the Cunning, the Giggly, the Magnificent, the Majestic, the Peculiar,
      the Splendid, the Wayward, the Hopeful,
      of the Reeds, of the Lilies, of the Deep, of the Shallows, of the Tides, of the Reef, of the Lagoon, of the North,
      of the South, of the East, of the West, of the Mist, of the Moon, of the Sun, of the Stars, of the Storm, of the Rapids,
      of the Falls, of the Pond, of the Brook, of the Glade, of the Grotto, of the Rocks, of the Moss, of the Ferns,
      of the Willows, of the Lotus, of the Dawn, of the Dusk, of the Night, of the Waves, of the Foam, of the Coral, of the Kelp,
      of the Sands, of the Pearls, of the Bubbles, of the Garden, of the Castle, of the Current, of the Springs, of the Ripples,
      of Niigata, of Kyoto, of Osaka, of Atlantis, of Avalon, of Lemuria, of Mossbrook, of Willowmere, of Reedholm, of Pebblebay,
      of Lilyford, of Coralcove, of Mistvale, of Tidewater, PhD,
      Splashworth, Bubblesby, Gillsworth, Scaleton, Pondsworth, Ripplewood, Brookfield, Reedwater, Lilypond, Mossbottom,
      Puddlefoot, Pebbleton, Fishwick, Finnegan, McFinn, O'Scale, Fintail, Troutman, Wavecrest, Tidewell, Shellby, Coralton,
      Driftwell, Kelpington, Bubbleton, Wetherby, Swishington, Softgill, von Bubble, von Splash, de la Mare, van Reed,
      Fairwater, Stillwater, Clearbrook, Deepwell, Sandbar, Pondfellow, Lakewood, Rivers, Brooks, Marsh, Fisher, Waters, Pike-Smith`,
  }),
  // Sex: titles and given names that say female or male.
  group('female', {
    prefixes: 'Lady, Dame, Baroness, Countess, Duchess, Princess, Queen, Empress, Miss, Madame, Marquise',
    nouns: `Cleo, Ophelia, Beatrix, Matilda, Agatha, Winifred, Mabel, Edna, Olga, Greta, Frida, Ingrid, Astrid, Penelope, Nora,
      Ada, Wanda, Daisy, Jasmine, Sachi, Emi, Mei, Yuna, Hina, Mika, Kasumi, Shizuka, Lulu, Fifi, Gigi, Bibi, Siren, Nymph`,
  }),
  group('male', {
    prefixes: 'Sir, Lord, Baron, Count, Duke, Prince, King, Emperor, Mister, Marquis, Viscount, Sultan, Squire, Master, Monsieur, Friar',
    nouns: `Oliver, Milo, Otto, Hugo, Felix, Barnaby, Percy, Reginald, Winston, Humphrey, Mortimer, Cornelius, Ignatius,
      Archibald, Gus, Waldo, Wally, Dexter, Chester, Rupert, Monty, Nigel, Clive, Gerald, Harold, Norbert, Ferdinand, Leopold,
      Augustus, Julius, Sven, Lars, Bjorn, Gunnar, Kaito, Kenji, Jiro, Taro, Ryu`,
    suffixes: 'Esquire',
  }),
  // Body color, for a single expressed variant.
  group('body:gold', { prefixes: 'Golden, Gilded', nouns: 'Goldie, Nugget, Bullion, Doubloon, Midas, Goldilocks, Aurum, Honey, Goldfinch', suffixes: 'the Golden, Goldscale, Goldsworth' }),
  group('body:slate', { prefixes: 'Misty, Foggy, Cloudy, Stormy', nouns: 'Slate, Pewter, Flint, Granite, Asagi, Nimbus, Stormcloud, Dove', suffixes: 'the Gray, Stormscale, Slatesworth' }),
  group('body:charcoal', { prefixes: 'Sooty, Inky, Smoky, Dusky, Midnight, Shadowy', nouns: 'Charcoal, Cinder, Soot, Onyx, Obsidian, Basalt, Coal, Kuro, Shadow, Raven, Licorice, Crow', suffixes: 'the Dark, Sootscale, of the Shadows' }),
  group('body:lavender', { prefixes: 'Lilac, Mauve', nouns: 'Lavender, Wisteria, Heather, Thistle, Orchid, Ube', suffixes: 'the Lilac, Lavenderscale, of the Heather' }),
  group('body:jade', {
    prefixes: 'Jade, Mossy, Minty, Leafy, Verdant, Emerald',
    nouns: 'Jadeite, Midori, Matcha, Wasabi, Moss, Fern, Clover, Pistachio, Kiwi, Sprout, Pickle, Pesto, Basil, Parsley, Kelp, Seaweed, Seafoam',
    suffixes: 'the Jaded, the Green, Jadescale, Greenscale, Jadesworth, of the Jade Pond',
  }),
  group('pale', { prefixes: 'Snowy, Frosty, Pale, Ivory, Milky', nouns: 'Mochi, Tofu, Snowflake, Snowdrop, Blizzard, Moonbeam, Shiro, Marshmallow, Snowball, Cotton', suffixes: 'the White, the Pale, Snowscale, of the Snows' }),
  // Accent color, where it is drawn.
  group('accent:orange', { prefixes: 'Ginger, Tangy, Fiery, Rusty', nouns: 'Tangerine, Clementine, Kumquat, Pumpkin, Apricot, Marmalade, Papaya, Mango, Carrot, Ember, Blaze, Marigold, Persimmon, Kitsune, Saffron, Paprika, Gingersnap', suffixes: 'the Fiery, of the Embers' }),
  group('accent:crimson', { prefixes: 'Crimson, Scarlet', nouns: 'Cherry, Poppy, Ruby, Garnet, Cranberry, Radish, Beet, Cinnabar', suffixes: 'the Red, the Crimson, of the Red Tide' }),
  group('accent:sunflower', { prefixes: 'Sunny, Lemony', nouns: 'Sunflower, Buttercup, Lemon, Canary, Dandelion, Banana, Custard, Primrose, Daffodil, Yuzu, Mustard', suffixes: 'the Yellow, of the Sunflowers' }),
  group('accent:cobalt', { prefixes: 'Cobalt, Azure', nouns: 'Blueberry, Bluebell, Sapphire, Cornflower, Denim, Indigo', suffixes: 'the Blue, of the Blue' }),
  group('accent:violet', { prefixes: 'Violet, Purply', nouns: 'Plum, Amethyst, Grape, Mulberry, Fig, Aubergine', suffixes: 'the Purple, the Violet' }),
  group('accent:pearl', { prefixes: 'Pearly, Creamy', nouns: 'Pearl, Vanilla, Cream, Eggshell, Meringue', suffixes: 'Pearlsworth' }),
  group('inkPatches', { prefixes: 'Dappled, Blotchy', nouns: 'Domino, Inkblot, Smudge, Patches, Splotch', suffixes: 'Inkspot, of the Ink' }),
  // Dots, where a spotted or calico pattern shows them.
  group('dots:ink', { prefixes: 'Peppered', nouns: 'Pepper, Poppyseed', suffixes: 'Inkspeck' }),
  group('dots:pearl', { prefixes: 'Pearl-Dotted', suffixes: 'Pearlspeck' }),
  group('dots:gold', { prefixes: 'Gold-Flecked', nouns: 'Goldfleck', suffixes: 'Goldspeck' }),
  group('dots:turquoise', { prefixes: 'Turquoise', suffixes: 'Tealspeck' }),
  group('dots:ruby', { prefixes: 'Ruby-Flecked', suffixes: 'Rubyspeck' }),
  group('dots:rainbow', { prefixes: 'Rainbow, Prismatic, Technicolor', nouns: 'Prism, Kaleidoscope, Hanabi', suffixes: 'the Rainbow, of the Rainbow' }),
  // Body and fin patterns.
  group('motif:spots', { prefixes: 'Spotted, Speckled, Dotty, Freckled', nouns: 'Freckles, Speckles, Polka, Spot', suffixes: 'the Spotted, the Speckled, Polkadot' }),
  group('motif:stripes', { prefixes: 'Striped, Stripey', nouns: 'Tiger, Stripes, Tigerstripe, Humbug', suffixes: 'the Striped, the Tiger' }),
  group(['motif:stripes', 'female'], { nouns: 'Tigress' }),
  group('motif:marble', { prefixes: 'Marbled, Swirly', nouns: 'Marble, Swirl', suffixes: 'the Marbled' }),
  group('motif:calico', { prefixes: 'Calico, Patchwork, Motley', nouns: 'Confetti, Sprinkles, Harlequin, Quilt', suffixes: 'the Calico' }),
  group('motif:rosettes', { prefixes: 'Leopard', nouns: 'Jaguar, Ocelot, Rosette', suffixes: 'the Leopard' }),
  group('fins:spots', { suffixes: 'Spotfin, Dotfin' }),
  group('fins:bands', { suffixes: 'Bandfin, Ringtail, Bandtail' }),
  group('fins:edge', { suffixes: 'Edgefin, Trimfin' }),
  group('fins:tips', { suffixes: 'Inktip, Blacktip, Darktip' }),
  group('fins:flame', { prefixes: 'Flame-Finned', nouns: 'Phoenix', suffixes: 'Flamefin, Firetail, Blazefin' }),
  // Eyes, scales and sheen.
  group('eyes:amber', { prefixes: 'Amber-Eyed', suffixes: 'Ambereye' }),
  group('eyes:ruby', { prefixes: 'Ruby-Eyed', suffixes: 'Rubyeye' }),
  group('eyes:sapphire', { prefixes: 'Sapphire-Eyed', suffixes: 'Sapphire-Eye' }),
  group('eyes:emerald', { prefixes: 'Emerald-Eyed', suffixes: 'Emerald-Eye' }),
  group('eyes:silver', { prefixes: 'Silver-Eyed', suffixes: 'Silvereye' }),
  group('scales:fine', { prefixes: 'Velvety', nouns: 'Velvet, Satin', suffixes: 'Finescale' }),
  group('scales:mirror', { prefixes: 'Mirrored', nouns: 'Mirror', suffixes: 'Mirrorscale' }),
  group('scales:net', { prefixes: 'Netted', nouns: 'Matsuba, Pinecone, Lattice', suffixes: 'Netscale' }),
  group('scales:pearl', { prefixes: 'Pearl-Scaled', suffixes: 'Pearlscale' }),
  group('scales:armor', { prefixes: 'Armored, Ironclad, Plated', nouns: 'Dragonscale, Shellback', suffixes: 'the Armored, Ironscale' }),
  group('sparkle', { prefixes: 'Sparkly, Glittery, Twinkly, Starry, Radiant, Glimmering', nouns: 'Twinkle, Glimmer, Stardust, Sequin, Glitter, Hotaru, Ginrin, Spark, Opal', suffixes: 'the Sparkling, the Radiant, Starscale, Glimmerscale' }),
  group('dazzle', { prefixes: 'Dazzling', nouns: 'Dazzle, Diamond, Disco', suffixes: 'the Dazzling' }),
  group('metallic', { prefixes: 'Shiny, Gleaming, Polished', nouns: 'Chrome, Ogon, Tinsel', suffixes: 'the Shiny, the Gleaming' }),
  group('glassy', { prefixes: 'Glassy, Ghostly', nouns: 'Phantom, Wisp, Specter, Quartz, Crystal, Icicle', suffixes: 'the Translucent' }),
  // Size, from adult length potential, and shape.
  group('huge', { prefixes: 'Jumbo, Giant, Colossal, Mammoth, Enormous', nouns: 'Titan, Leviathan, Behemoth, Boulder, Colossus, Goliath, Kraken', suffixes: 'the Vast, the Enormous, the Colossal' }),
  group('big', { prefixes: 'Big, Hefty, Mighty, Great, Burly', nouns: 'Moose, Whopper, Bruiser', suffixes: 'the Great, the Mighty, the Hefty' }),
  group('small', { prefixes: 'Little, Mini, Petite, Small, Pocket, Dainty', nouns: 'Button, Peanut, Pip, Dot, Minnow, Shrimp, Pixie, Sprite, Imp, Bonsai, Pebble, Tiddler, Munchkin', suffixes: 'the Little, the Small' }),
  group('tiny', { prefixes: 'Tiny, Wee, Teeny, Itty-Bitty', nouns: 'Thimble, Speck, Crumb, Krill, Plankton, Smidge', suffixes: 'the Tiny, the Teeny' }),
  group('longTail', { prefixes: 'Flowing, Frilly, Silken', nouns: 'Butterfly, Streamer, Ribbon', suffixes: 'Longfin, Veiltail, Ribbontail, Silktail, Sweeptail, the Long-Tailed' }),
  group('shortTail', { prefixes: 'Stubby, Stumpy', suffixes: 'Bobtail, Shorttail' }),
  group('round', { prefixes: 'Chubby, Plump, Round, Tubby, Pudgy, Roly-Poly', nouns: 'Dumpling, Bun, Meatball, Butterball, Pudge', suffixes: 'the Plump, the Stout, the Round' }),
  group('slim', { prefixes: 'Slender, Slim, Skinny, Lanky', nouns: 'Noodle, Twig, Pencil, Spaghetti, Linguine', suffixes: 'the Slender, the Slim' }),
  group('whiskers', { prefixes: 'Whiskery, Bearded', nouns: 'Whiskers, Mustache, Walrus, Moustachio', suffixes: 'the Whiskered, Longwhisker' }),
  group('bigEyes', { prefixes: 'Big-Eyed, Wide-Eyed, Goggle-Eyed', nouns: 'Goggles, Peepers, Owl', suffixes: 'the Wide-Eyed' }),
  // Metabolism, movement and inherited tendencies.
  group('hungry', { prefixes: 'Hungry, Peckish, Snacky', nouns: 'Nibbles, Muncher, Gobbles, Chomp, Gulp, Gobbler', suffixes: 'the Hungry, the Snacky, the Ravenous, Nibbleton' }),
  group('agile', { prefixes: 'Nimble, Twirling, Dancing, Acrobatic, Twirly', nouns: 'Pirouette, Zigzag, Swerve, Dodger, Tumbler', suffixes: 'the Nimble, the Acrobat' }),
  group('fast', { prefixes: 'Swift, Speedy, Quick, Flying, Zippy', nouns: 'Rocket, Comet, Meteor, Dash, Bolt, Jet, Turbo, Zoom', suffixes: 'the Swift, the Speedy, the Hasty, Quickfin, the Zoomy' }),
  group('slow', { prefixes: 'Poky, Unhurried, Leisurely', nouns: 'Slowpoke, Dawdle, Snail, Tortoise', suffixes: 'the Unhurried, the Leisurely' }),
  group('active', { prefixes: 'Bouncy, Busy, Restless, Wiggly, Lively, Rowdy, Fidgety', nouns: 'Fidget, Jitterbug, Scamper, Bustle, Pogo', suffixes: 'the Restless, the Tireless, the Wiggly, the Lively' }),
  group('calm', { prefixes: 'Sleepy, Lazy, Dozy, Drowsy, Mellow, Calm, Quiet, Drifting, Serene', nouns: 'Snooze, Napper, Loafer, Drifter, Dozer', suffixes: 'the Sleepy, the Lazy, the Calm, the Serene, the Quiet' }),
  group('bold', { prefixes: 'Brave, Bold, Daring, Fearless, Plucky, Gutsy, Valiant, Fierce', nouns: 'Maverick, Daredevil, Lionheart', suffixes: 'the Bold, the Brave, the Fearless, the Daring, the Valiant' }),
  group('shy', { prefixes: 'Shy, Bashful, Timid, Meek, Skittish', nouns: 'Wallflower, Hideaway', suffixes: 'the Shy, the Bashful, the Timid, the Unseen' }),
  group('social', { prefixes: 'Friendly, Chummy, Sociable', nouns: 'Buddy, Pal, Chum', suffixes: 'the Friendly, the Sociable' }),
  group('loner', { prefixes: 'Aloof, Solitary, Lonesome', nouns: 'Hermit, Loner, Solo, Recluse', suffixes: 'the Lone, the Solitary' }),
  group('curious', { prefixes: 'Curious, Nosy, Wandering, Inquisitive', nouns: 'Explorer, Seeker, Sleuth, Scout, Wanderer, Snooper, Busybody', suffixes: 'the Curious, the Explorer, the Wanderer' }),
  group('incurious', { prefixes: 'Unbothered', suffixes: 'the Unbothered, the Unimpressed' }),
];

export type NamePart = { word: string; slot: Slot; group: NameGroup };
type Entry = NamePart;

/**
 * A name for the key, with the group each part came from, that is not in `taken`, at most MAX_NAME_LENGTH characters,
 * without a repeated word and with at most one part per trait group. The same key, tags and taken set always give the
 * same name. If every attempt is taken, the last readable candidate is kept.
 */
export function draftName(key: string, tags: ReadonlySet<NameTag>, taken: ReadonlySet<string> = new Set()): { name: string; parts: NamePart[] } {
  const usable = NAME_GROUPS.filter(entry => entry.when.every(tag => tags.has(tag)));
  const entries = (slot: Slot, themedOnly: boolean): Entry[] => usable.flatMap(entry => themedOnly && !entry.themed ? [] : entry[slot].map(word => ({ word, slot, group: entry })));
  const all = { prefixes: entries('prefixes', false), nouns: entries('nouns', false), suffixes: entries('suffixes', false) };
  const themed = { prefixes: entries('prefixes', true), nouns: entries('nouns', true), suffixes: entries('suffixes', true) };
  const themeSlots = SLOTS.filter(slot => themed[slot].length);
  let fallback: { name: string; parts: NamePart[] } | null = null;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const draw = random(hash(`${key}:name:${attempt}`)), pick = <T>(pool: readonly T[]) => pool[Math.floor(draw() * pool.length)];
    // About half of the names that can mention a trait put one trait word in a chosen slot, adding that slot if needed.
    const theme = themeSlots.length && draw() < THEMED_SHARE ? pick(themeSlots) : null;
    const count = 1 + Math.floor(draw() * 3);
    const withPrefix = theme === 'prefixes' || count === 3 || (count === 2 && draw() < 0.5);
    const withSuffix = theme === 'suffixes' || count === 3 || (count === 2 && !withPrefix);
    const choose = (slot: Slot) => pick(slot === theme ? themed[slot] : all[slot]);
    const parts = [withPrefix ? choose('prefixes') : null, choose('nouns'), withSuffix ? choose('suffixes') : null].filter((part): part is Entry => part !== null);
    const name = parts.map(part => part.word).join(' '), spoken = name.toLowerCase().split(/[\s-]+/);
    const traitGroups = parts.filter(part => part.group.when.length).map(part => part.group);
    if (name.length > MAX_NAME_LENGTH || new Set(spoken).size !== spoken.length || new Set(traitGroups).size !== traitGroups.length) continue;
    if (!taken.has(name)) return { name, parts };
    fallback = { name, parts };
  }
  if (fallback) return fallback;
  const noun = all.nouns[hash(key) % all.nouns.length];
  return { name: noun.word, parts: [noun] };
}

export const generateName = (key: string, tags: ReadonlySet<NameTag>, taken?: ReadonlySet<string>) => draftName(key, tags, taken).name;

/** Every name in use by a fish record or shop listing, so new names avoid them. */
export const takenNames = (world: World) => new Set([...world.fish.map(member => member.name), ...world.shop.listings.map(listing => listing.name)]);

/** The name for a new fish from its sex and genome; it is added to `taken`, so a batch of births stays distinct. */
export function newFishName(key: string, fish: Pick<Fish, 'sex' | 'genome'>, taken: Set<string>): string {
  if (isAxolotlGenome(fish.genome)) return newAxolotlName(key, fish.sex, fish.genome, taken);
  const name = generateName(key, nameTags(fish.sex, express(fish.genome)), taken);
  taken.add(name);
  return name;
}
