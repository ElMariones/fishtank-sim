import { hash, random } from './random';
import type { NamingModel, World } from './types';

/**
 * Naming model 2: a new fish gets a readable name built from one, two or three parts: a noun, alone or with a prefix
 * and/or a suffix ("Mochi", "Captain Mochi", "Mochi of the Reeds", "Sleepy Mochi Splashworth"). About 20 million
 * combinations exist, and a name already used in the world is rerolled, so duplicates practically never happen.
 * Model 1 is the numbered names ("Fry 12", "Newcomer 7") that older journals replay with. Names stay mutable text:
 * they never feed genetics, prices or identity.
 */
export const NAMING_MODEL = 2 satisfies NamingModel;
export const MAX_NAME_LENGTH = 32;
const ATTEMPTS = 32;

const list = (text: string) => text.split(',').map(entry => entry.trim()).filter(Boolean);

export const NAME_PREFIXES = list(`
  Sir, Lady, Lord, Dame, Captain, Admiral, Commodore, Major, Colonel, General, Sergeant, Professor, Doctor, Baron, Baroness,
  Count, Countess, Duke, Duchess, Prince, Princess, King, Queen, Emperor, Empress, Master, Mister, Miss, Madame, Uncle,
  Auntie, Grandpa, Granny, Chef, Judge, Mayor, Abbot, Friar, Brother, Sister, Elder, Squire, Marquis, Viscount, Sheriff,
  Skipper, Bosun, Maestro, Sensei, Shogun, Regent, Consul, Sultan, Young, Old, Little, Big, Tiny, Mighty, Grand, Great, Wee,
  Baby, Mini, Jumbo, Giant, Petite, Golden, Silver, Copper, Bronze, Crimson, Scarlet, Rusty, Ivory, Azure, Cobalt, Indigo,
  Lilac, Rosy, Peachy, Minty, Inky, Sooty, Snowy, Pearly, Glassy, Velvet, Satin, Silken, Dusky, Misty, Foggy, Cloudy,
  Stormy, Sunny, Rainy, Windy, Frosty, Starry, Moony, Shady, Brave, Bold, Swift, Quick, Lazy, Sleepy, Dozy, Grumpy, Happy,
  Jolly, Merry, Lucky, Plucky, Cheeky, Sneaky, Shy, Gentle, Noble, Humble, Clever, Wise, Silly, Dizzy, Fancy, Dapper, Proud,
  Fierce, Wild, Calm, Quiet, Mellow, Zesty, Spicy, Sweet, Salty, Sassy, Bubbly, Wiggly, Wobbly, Sparkly, Shiny, Dreamy,
  Curious, Restless, Patient, Loyal, Royal, Secret, Mystic, Cosmic, Lunar, Solar, Astral, Ancient, Eternal, Hidden, Lost,
  Wandering, Drifting, Dancing, Singing, Flying, Gliding, Twirling, Humming, Whistling, Giggling, Blinking, Nimble, Dainty,
  Chubby, Plump, Slender, Speckled, Spotted, Striped, Freckled, Dappled, Painted, Gilded, Frilly, Fuzzy, Lanky, Stubby,
  Crooked, Tidy, Scruffy, Rumpled, Mossy, Sandy, Muddy, Briny, Tidal, Coastal, Northern, Southern, Eastern, Western,
  Deepwater, Midnight, Twilight, Morning, Evening, Autumn, Winter, Summer, Radiant, Grumbly, Snazzy, Jazzy, Groovy,
`);

export const NAME_NOUNS = list(`
  Mochi, Dumpling, Noodle, Biscuit, Muffin, Waffle, Pancake, Crumpet, Pretzel, Cookie, Cupcake, Brownie, Toffee, Caramel,
  Fudge, Nougat, Truffle, Praline, Marzipan, Sorbet, Gelato, Custard, Pudding, Tapioca, Boba, Wasabi, Tofu, Miso, Ramen,
  Udon, Soba, Sushi, Nori, Tempura, Onigiri, Dango, Taiyaki, Matcha, Sesame, Ginger, Nutmeg, Paprika, Pepper, Clove, Basil,
  Parsley, Thyme, Fennel, Radish, Turnip, Pumpkin, Squash, Olive, Pickle, Peanut, Cashew, Pistachio, Almond, Walnut, Hazel,
  Acorn, Chestnut, Coconut, Mango, Papaya, Kiwi, Lychee, Plum, Apricot, Peach, Cherry, Berry, Lemon, Lime, Tangerine,
  Clementine, Kumquat, Yuzu, Fig, Quince, Melon, Guava, Banana, Butter, Toast, Crouton, Bagel, Scone, Churro, Taco, Nacho,
  Burrito, Gnocchi, Ravioli, Macaroni, Tortellini, Pesto, Risotto, Paella, Falafel, Hummus, Kebab, Samosa, Chutney, Curry,
  Masala, Bonbon, Jellybean, Gumdrop, Lollipop, Sprinkles, Cocoa, Espresso, Latte, Mocha, Chai, Oolong, Sencha,
  Ember, Cinder, Spark, Flicker, Blaze, Comet, Meteor, Nova, Nebula, Quasar, Pulsar, Orbit, Eclipse, Zenith, Aurora, Galaxy,
  Cosmos, Stardust, Moonbeam, Sunbeam, Rainbow, Thunder, Lightning, Drizzle, Breeze, Gale, Tempest, Cyclone, Monsoon,
  Blizzard, Snowflake, Icicle, Glacier, Dewdrop, Raindrop, Puddle, Ripple, Wave, Tide, Eddy, Whirlpool, Riptide, Lagoon,
  Reef, Atoll, Shoal, Cove, Harbor, Delta, Brook, Creek, Rivulet, Cascade, Rapids, Fountain, Geyser, Pebble, Boulder,
  Cobble, Flint, Granite, Basalt, Quartz, Opal, Onyx, Garnet, Topaz, Sapphire, Emerald, Ruby, Amethyst, Jasper, Agate,
  Obsidian, Pearl, Coral, Jade, Amber, Moss, Fern, Lichen, Clover, Thistle, Nettle, Bramble, Briar, Heather, Juniper,
  Willow, Birch, Aspen, Cedar, Cypress, Maple, Rowan, Alder, Hemlock, Sequoia, Bamboo, Bonsai, Lotus, Lily, Iris, Orchid,
  Tulip, Daisy, Poppy, Violet, Dahlia, Peony, Camellia, Azalea, Magnolia, Jasmine, Lavender, Marigold, Buttercup,
  Bluebell, Snowdrop, Primrose, Wisteria, Hibiscus, Sakura, Tsubaki, Momiji, Pinecone, Thimble,
  Bubbles, Splash, Sploosh, Plop, Drip, Gulp, Nibbles, Fin, Finn, Gill, Scales, Snapper, Guppy, Minnow, Tetra, Molly, Platy,
  Danio, Loach, Pleco, Gourami, Betta, Oscar, Discus, Goby, Blenny, Wrasse, Tang, Grouper, Marlin, Tuna, Salmon, Trout,
  Carp, Pike, Perch, Bass, Haddock, Herring, Sardine, Anchovy, Mackerel, Halibut, Flounder, Sturgeon, Barracuda, Seahorse,
  Starfish, Urchin, Anemone, Nautilus, Squid, Octopus, Krill, Shrimp, Prawn, Lobster, Clam, Mussel, Oyster, Scallop,
  Conch, Periwinkle, Limpet, Barnacle, Kelp, Seaweed, Plankton, Driftwood, Lantern, Anchor, Compass, Sextant, Buoy, Rudder,
  Paddle, Oar, Sail, Mast, Galleon, Dinghy, Schooner, Canoe, Kayak,
  Dragon, Wyvern, Phoenix, Griffin, Kraken, Leviathan, Selkie, Siren, Nymph, Sprite, Pixie, Goblin, Gremlin, Imp, Wisp,
  Phantom, Golem, Titan, Oracle, Wizard, Druid, Bard, Knight, Paladin, Ranger, Rogue, Pirate, Corsair, Buccaneer, Viking,
  Samurai, Ronin, Ninja, Shinobi, Monk, Hermit, Nomad, Pilgrim, Voyager, Rover, Scout, Wanderer, Drifter, Dreamer, Jester,
  Minstrel, Juggler, Tinker, Cobbler, Baker, Potter, Weaver, Miller, Fletcher, Archer, Gambit, Rascal, Scamp, Rebel,
  Bandit, Outlaw, Maverick, Rocket, Zephyr, Echo, Riddle, Puzzle, Enigma, Cipher, Rune, Sigil, Talisman, Amulet, Trinket,
  Bauble, Button, Marble, Domino, Yoyo, Kite, Whistle, Trumpet, Tuba, Banjo, Ukulele, Fiddle, Piccolo, Oboe, Cello, Harp,
  Lute, Sitar, Bongo, Maraca, Cymbal, Tambourine, Kazoo, Melody, Harmony, Sonata, Ballad, Lullaby, Jingle, Tango, Salsa,
  Samba, Rumba, Polka, Waltz, Bolero, Mambo, Disco, Boogie, Opera,
  Hikari, Kaede, Kaito, Ryu, Kenji, Taro, Jiro, Sachi, Emi, Mei, Rin, Yuna, Kai, Aoi, Hina, Mika, Kumo, Tsuki, Hotaru,
  Kitsune, Tanuki, Neko, Kappa, Tengu, Daruma, Hanabi, Kasumi, Shizuka, Asahi, Yoru, Hibiki, Kuro, Shiro, Midori, Ginrin,
  Tancho, Showa, Sanke, Ogon, Asagi, Shusui, Utsuri, Bekko, Goshiki, Kujaku, Ochiba, Chagoi, Karashi, Benigoi, Matsuba,
  Oliver, Milo, Otto, Hugo, Felix, Rufus, Barnaby, Percy, Reginald, Winston, Humphrey, Mortimer, Cornelius, Ignatius,
  Archibald, Gus, Waldo, Wally, Ziggy, Bingo, Bruno, Dexter, Chester, Rupert, Monty, Nigel, Clive, Gerald, Harold,
  Norbert, Ferdinand, Leopold, Augustus, Julius, Cleo, Ophelia, Beatrix, Matilda, Agatha, Winifred, Mabel, Edna, Olga,
  Greta, Frida, Ingrid, Astrid, Sven, Lars, Bjorn, Magnus, Gunnar, Pip, Kip, Dot, Bix, Zuzu, Lulu, Coco, Fifi, Gigi, Bibi,
`);

export const NAME_SUFFIXES = list(`
  the Bold, the Brave, the Swift, the Wise, the Great, the Grand, the Gentle, the Fierce, the Clever, the Quiet, the Mighty,
  the Radiant, the Curious, the Sleepy, the Hungry, the Lucky, the Unlucky, the Patient, the Restless, the Wanderer,
  the Dreamer, the Explorer, the Navigator, the Elder, the Younger, the First, the Second, the Third, the Last, the Lost,
  the Found, the Unseen, the Glorious, the Graceful, the Nimble, the Dapper, the Stout, the Plump, the Tiny, the Vast,
  the Silent, the Loud, the Merry, the Jolly, the Grumpy, the Humble, the Proud, the Noble, the Kind, the Just, the Bright,
  the Shiny, the Spotted, the Striped, the Speckled, the Unready, the Fearless, the Tireless, the Relentless,
  the Invincible, the Legendary, the Ancient, the Eternal, the Daring, the Dashing, the Charming, the Sly, the Crafty,
  the Cunning, the Hasty, the Lazy, the Bashful, the Giggly, the Wiggly, the Wobbly, the Magnificent, the Majestic,
  the Peculiar, the Splendid, the Serene, the Snacky, the Zoomy, the Gleaming, the Unbothered, the Wayward, the Hopeful,
  of the Reeds, of the Lilies, of the Deep, of the Shallows, of the Tides, of the Reef, of the Lagoon, of the North,
  of the South, of the East, of the West, of the Mist, of the Moon, of the Sun, of the Stars, of the Storm, of the Rapids,
  of the Falls, of the Pond, of the Brook, of the Glade, of the Grotto, of the Rocks, of the Moss, of the Ferns,
  of the Willows, of the Lotus, of the Dawn, of the Dusk, of the Night, of the Waves, of the Foam, of the Coral, of the Kelp,
  of the Sands, of the Pearls, of the Bubbles, of the Garden, of the Castle, of the Current, of the Springs, of the Ripples,
  of Niigata, of Kyoto, of Osaka, of Atlantis, of Avalon, of Lemuria, of Mossbrook, of Willowmere, of Reedholm, of Pebblebay,
  of Lilyford, of Coralcove, of Mistvale, of Tidewater,
  Jr., Sr., II, III, IV, V, VI, VII, Esquire, PhD,
  Splashworth, Bubblesby, Gillsworth, Scaleton, Pondsworth, Ripplewood, Brookfield, Reedwater, Lilypond, Mossbottom,
  Puddlefoot, Pebbleton, Fishwick, Finnegan, McFinn, O'Scale, Fintail, Troutman, Wavecrest, Tidewell, Shellby, Coralton,
  Driftwell, Kelpington, Bubbleton, Wetherby, Swishington, Glimmerfin, Silvertail, Goldscale, Moonfin, Starscale,
  Sunfin, Longfin, Quickfin, Softgill, von Bubble, von Splash, de la Mare, van Reed, Fairwater, Stillwater, Clearbrook,
  Deepwell, Mudsworth, Sandbar, Pondfellow, Lakewood, Rivers, Brooks, Marsh, Fisher, Waters, Pike-Smith, Nibbleton,
`);

/**
 * A name for the key that is not in `taken`, at most MAX_NAME_LENGTH characters and without a repeated word. The same
 * key and taken set always give the same name. If every attempt is taken, the last readable candidate is kept.
 */
export function generateName(key: string, taken: ReadonlySet<string> = new Set()): string {
  let fallback: string | null = null;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const draw = random(hash(`${key}:name:${attempt}`)), pick = (pool: readonly string[]) => pool[Math.floor(draw() * pool.length)];
    // One, two or three parts in equal shares; two parts pair the noun with either a prefix or a suffix.
    const count = 1 + Math.floor(draw() * 3), withPrefix = count === 3 || (count === 2 && draw() < 0.5), noun = pick(NAME_NOUNS);
    const parts = [withPrefix ? pick(NAME_PREFIXES) : '', noun, count === 3 || (count === 2 && !withPrefix) ? pick(NAME_SUFFIXES) : ''].filter(Boolean);
    const name = parts.join(' '), words = name.toLowerCase().split(' ');
    if (name.length > MAX_NAME_LENGTH || new Set(words).size !== words.length) continue;
    if (!taken.has(name)) return name;
    fallback = name;
  }
  return fallback ?? NAME_NOUNS[hash(key) % NAME_NOUNS.length];
}

/** Every name in use by a fish record or shop listing, so new names avoid them. */
export const takenNames = (world: World) => new Set([...world.fish.map(member => member.name), ...world.shop.listings.map(listing => listing.name)]);

/**
 * The name for a new fish: the numbered legacy name under naming model 1, otherwise a generated name for the key that
 * is added to `taken`, so a batch of births stays distinct.
 */
export function newFishName(naming: NamingModel, legacy: string, key: string, taken: Set<string>): string {
  if (naming === 1) return legacy;
  const name = generateName(key, taken);
  taken.add(name);
  return name;
}
