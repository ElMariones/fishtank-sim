import { describe, expect, it } from 'vitest';
import { APPEARANCE_LOCI, LOCI, type AppearanceLocus, type Locus } from '../src/core/catalog';
import { express, founderGenome } from '../src/core/genetics';
import { advanceWorld } from '../src/core/habitat';
import { draftName, generateName, MAX_NAME_LENGTH, NAME_GROUPS, NAMING_MODEL, nameTags, THEMED_SHARE, type NameTag } from '../src/core/names';
import { random } from '../src/core/random';
import { commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import { decodeSave } from '../src/core/save';
import type { Fish, Genome, World } from '../src/core/types';
import { TICKS_PER_GAME_DAY } from '../src/core/water';
import { applyCommand, createWorld, type Command } from '../src/core/world';

const NOW = '2026-09-15T12:00:00.000Z';
const DAY = TICKS_PER_GAME_DAY;
const NUMBERED = /^(Fry|Newcomer) \d+$/;
const cross: Command = { type: 'breed', motherId: 'FSH-000001', fatherId: 'FSH-000002', tankId: 'tank-2', timestamp: NOW, genomeVersion: 3 };
const pair: Command = { type: 'pair', motherId: 'FSH-000003', fatherId: 'FSH-000004', nurseryId: 'tank-2', size: 20, timestamp: NOW, genomeVersion: 3 };
const names = (world: World) => world.fish.map(member => member.name);
const neutral = NAME_GROUPS[0];
const everyWord = (group: typeof neutral) => [...group.prefixes, ...group.nouns, ...group.suffixes];

/** A copy of the genome with both copies of each named locus set. */
function withAlleles(genome: Genome, alleles: Partial<Record<Locus | AppearanceLocus, [number, number]>>): Genome {
  const next = { ...genome, maternal: [...genome.maternal], paternal: [...genome.paternal] };
  for (const [locus, [a, b]] of Object.entries(alleles) as [string, [number, number]][]) {
    const i = (LOCI as readonly string[]).includes(locus) ? LOCI.indexOf(locus as Locus) : LOCI.length + APPEARANCE_LOCI.indexOf(locus as AppearanceLocus);
    next.maternal[i] = a; next.paternal[i] = b;
  }
  return next;
}
/** Genome v2 with the classic look, average pigment and middling tendencies, so each test sets only what it checks. */
const plainGenome = () => withAlleles(founderGenome(11, 2), Object.fromEntries([
  ...APPEARANCE_LOCI.map(locus => [locus, [0, 0]]),
  ...(['red', 'black', 'white', 'yellow', 'fin_pigment', 'translucency', 'reflectivity', 'activity', 'boldness', 'sociability', 'curiosity',
    'size_1', 'size_2', 'body_length', 'tail_length', 'fin_gain', 'body_depth', 'barbel_length', 'eye_size', 'metabolism', 'turning', 'thrust', 'pigment_gain'] as const).map(locus => [locus, [2, 2]]),
  ['melanin_switch', [0, 0]], ['metallic_switch', [0, 0]],
]));
const tagsOf = (genome: Genome, sex: Fish['sex'] = 'F') => nameTags(sex, express(genome));
const withPrefix = (tags: Set<NameTag>, prefix: string) => [...tags].filter(tag => tag.startsWith(prefix));

/** Varied fish: founder stock, and half of them with random appearance and extreme tendencies, size and shape. */
function sampleFish(i: number): Pick<Fish, 'sex' | 'genome'> {
  const rng = random(9000 + i), allele = () => Math.floor(rng() * 6);
  let genome = founderGenome(5000 + i, i % 5 === 0 ? 1 : 2);
  if (genome.version === 2 && i % 2) for (let k = LOCI.length; k < genome.maternal.length; k++) { genome.maternal[k] = allele(); genome.paternal[k] = allele(); }
  if (i % 3 === 0) {
    const extremes = ['activity', 'boldness', 'sociability', 'curiosity', 'size_1', 'size_2', 'tail_length', 'body_depth', 'barbel_length', 'eye_size',
      'metabolism', 'turning', 'thrust', 'translucency', 'reflectivity', 'white', 'yellow', 'red', 'black', 'fin_pigment'] as const;
    genome = withAlleles(genome, Object.fromEntries(extremes.map(locus => { const v = rng() < 0.5 ? allele() % 2 : 4 + allele() % 2; return [locus, [v, v]]; })));
  }
  return { sex: i % 2 ? 'M' : 'F', genome };
}

describe('ADR-056 truthful fish names', () => {
  it('keeps trait words out of the neutral vocabulary and inside the groups that require them', () => {
    expect(neutral.when).toEqual([]);
    expect([neutral.prefixes.length, neutral.nouns.length, neutral.suffixes.length].every((n, i) => n >= [80, 250, 120][i])).toBe(true);
    for (const group of NAME_GROUPS) {
      for (const pool of [group.prefixes, group.nouns, group.suffixes]) {
        expect(new Set(pool).size).toBe(pool.length);
        for (const part of pool) expect(part).toMatch(/^\S+( \S+)*$/);
      }
      for (const part of [...group.prefixes, ...group.nouns]) expect(part).not.toContain(' ');
      if (group !== neutral) for (const word of everyWord(group)) expect(everyWord(neutral)).not.toContain(word);
    }
    const claims: [string, NameTag[]][] = [
      ['Golden', ['body:gold']], ['Jade', ['body:jade']], ['Matcha', ['body:jade']], ['the Jaded', ['body:jade']], ['Kuro', ['body:charcoal']],
      ['Lavender', ['body:lavender']], ['Snowy', ['pale']], ['Tangerine', ['accent:orange']], ['Scarlet', ['accent:crimson']], ['Sapphire', ['accent:cobalt']],
      ['Canary', ['accent:sunflower']], ['Plum', ['accent:violet']], ['Tiger', ['motif:stripes']], ['Tigress', ['motif:stripes', 'female']], ['Leopard', ['motif:rosettes']],
      ['Calico', ['motif:calico']], ['Spotted', ['motif:spots']], ['Flamefin', ['fins:flame']], ['Blacktip', ['fins:tips']], ['Emerald-Eyed', ['eyes:emerald']],
      ['Rainbow', ['dots:rainbow']], ['Sparkly', ['sparkle']], ['Shiny', ['metallic']], ['Ghostly', ['glassy']], ['Armored', ['scales:armor']], ['Pinecone', ['scales:net']],
      ['Jumbo', ['huge']], ['Big', ['big']], ['Little', ['small']], ['Tiny', ['tiny']], ['Longfin', ['longTail']], ['Chubby', ['round']], ['Slender', ['slim']],
      ['Whiskers', ['whiskers']], ['Swift', ['fast']], ['Slowpoke', ['slow']], ['Sleepy', ['calm']], ['Restless', ['active']], ['Brave', ['bold']], ['Shy', ['shy']],
      ['Friendly', ['social']], ['Hermit', ['loner']], ['Curious', ['curious']], ['Queen', ['female']], ['Lady', ['female']], ['King', ['male']], ['Sir', ['male']],
    ];
    for (const [word, tags] of claims) {
      const holders = NAME_GROUPS.filter(group => everyWord(group).includes(word));
      expect(holders.length, word).toBeGreaterThan(0);
      for (const holder of holders) expect(tags.every(tag => holder.when.includes(tag)), word).toBe(true);
    }
  });

  it('tags only what a fish visibly shows or measurably is', () => {
    const plain = plainGenome(), tags = tagsOf(plain);
    expect([...tags].filter(tag => tag !== 'female')).toEqual([]);
    expect(tagsOf(plain, 'M').has('male') && !tagsOf(plain, 'M').has('female')).toBe(true);
    expect(withPrefix(tagsOf(withAlleles(plain, { base_color: [5, 5] })), 'body:')).toEqual(['body:jade']);
    expect(withPrefix(tagsOf(withAlleles(plain, { base_color: [1, 1] })), 'body:')).toEqual(['body:gold']);
    // A blended body mixes hues and a single hidden copy shows the classic body: neither is named for a color.
    expect(withPrefix(tagsOf(withAlleles(plain, { base_color: [1, 5] })), 'body:')).toEqual([]);
    expect(withPrefix(tagsOf(withAlleles(plain, { base_color: [0, 5] })), 'body:')).toEqual([]);
    expect(tagsOf(withAlleles(plain, { body_motif: [2, 2] })).has('motif:stripes')).toBe(true);
    expect(tagsOf(withAlleles(plain, { body_motif: [0, 2] })).has('motif:stripes')).toBe(true);
    expect(withPrefix(tagsOf(withAlleles(plain, { body_motif: [1, 1] })), 'motif:')).toEqual(['motif:spots']);
    // An accent color is named only when it is drawn.
    expect(tagsOf(withAlleles(plain, { accent_color: [1, 1], red: [0, 0], fin_pigment: [0, 0] })).has('accent:crimson')).toBe(false);
    expect(tagsOf(withAlleles(plain, { accent_color: [1, 1], red: [5, 5], pigment_gain: [5, 5] })).has('accent:crimson')).toBe(true);
    expect(tagsOf(withAlleles(plain, { accent_color: [1, 1], fin_pigment: [5, 5] })).has('accent:crimson')).toBe(true);
    expect(tagsOf(withAlleles(plain, { red: [5, 5], pigment_gain: [5, 5], yellow: [0, 0] })).has('accent:orange')).toBe(false);
    expect(tagsOf(withAlleles(plain, { red: [5, 5], pigment_gain: [5, 5] })).has('accent:orange')).toBe(true);
    expect(withPrefix(tagsOf(withAlleles(plain, { iris_color: [4, 4] })), 'eyes:')).toEqual(['eyes:emerald']);
    expect(withPrefix(tagsOf(withAlleles(plain, { iris_color: [3, 4] })), 'eyes:')).toEqual([]);
    const huge = tagsOf(withAlleles(plain, { size_1: [5, 5], size_2: [5, 5], body_length: [5, 5] }));
    expect([huge.has('huge'), huge.has('big'), huge.has('small')]).toEqual([true, true, false]);
    const tiny = tagsOf(withAlleles(plain, { size_1: [0, 0], size_2: [0, 0], body_length: [0, 0] }));
    expect([tiny.has('tiny'), tiny.has('small'), tiny.has('big')]).toEqual([true, true, false]);
    expect(tagsOf(withAlleles(plain, { activity: [4, 3] })).has('active')).toBe(true);
    expect(tagsOf(withAlleles(plain, { activity: [3, 3] })).has('active')).toBe(false);
    expect(tagsOf(withAlleles(plain, { activity: [1, 1] })).has('calm')).toBe(true);
    expect(tagsOf(withAlleles(plain, { boldness: [5, 5] })).has('bold')).toBe(true);
    // Genome v1 fish always show the classic appearance, so no appearance variant is named.
    const v1 = nameTags('M', express(founderGenome(3, 1)));
    expect([...v1].filter(tag => /^(body|motif|fins|eyes|scales|dots):/.test(tag) || tag === 'sparkle')).toEqual([]);
  });

  it('never gives a fish a word its traits do not support, and often names a trait it has', () => {
    const taken = new Set<string>(), reached = new Set(NAME_GROUPS.map((_, i) => i).filter(i => !NAME_GROUPS[i].when.length));
    let canTheme = 0, themed = 0;
    for (let i = 0; i < 4000; i++) {
      const fish = sampleFish(i), tags = nameTags(fish.sex, express(fish.genome));
      const { name, parts } = draftName(`truth:${i}`, tags, taken);
      taken.add(name);
      for (const part of parts) expect(part.group.when.every(tag => tags.has(tag)), `${name}: ${part.word}`).toBe(true);
      NAME_GROUPS.forEach((group, g) => { if (group.when.every(tag => tags.has(tag))) reached.add(g); });
      if (NAME_GROUPS.some(group => group.themed && group.when.every(tag => tags.has(tag)))) {
        canTheme++;
        if (parts.some(part => part.group.themed)) themed++;
      }
    }
    expect(reached.size).toBe(NAME_GROUPS.length);
    expect(taken.size).toBe(4000);
    expect(themed / canTheme).toBeGreaterThan(THEMED_SHARE - 0.05);
    expect(themed / canTheme).toBeLessThan(THEMED_SHARE + 0.2);
  });

  it('gives deterministic, readable names that avoid names in use', () => {
    const tags = new Set<NameTag>(['female']);
    expect(generateName('seed:fish:1', tags)).toBe(generateName('seed:fish:1', tags));
    const taken = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      const name = generateName(`481516:fish:${i}`, tags, taken);
      expect(taken.has(name)).toBe(false);
      expect(name.length).toBeLessThanOrEqual(MAX_NAME_LENGTH);
      const spoken = name.toLowerCase().split(/[\s-]+/);
      expect(new Set(spoken).size).toBe(spoken.length);
      taken.add(name);
    }
    expect(taken.size).toBe(10_000);
    // Without avoidance, multi-part names still rarely repeat, even from the neutral words alone.
    const multi = Array.from({ length: 10_000 }, (_, i) => generateName(`7:fish:${i}`, tags)).filter(name => name.includes(' '));
    expect(new Set(multi).size).toBeGreaterThan(multi.length * 0.97);
  });

  it('names new worlds, shop deliveries, lab crosses, bought stock and clutch eggs, keeping them distinct', () => {
    const world = createWorld(NOW);
    expect(world.naming).toBe(NAMING_MODEL);
    const listed = world.shop.listings.map(listing => listing.name);
    expect(new Set(listed).size).toBe(listed.length);

    let next = applyCommand(world, cross);
    next = applyCommand(next, { type: 'buy', tankId: 'tank-1', timestamp: NOW, genomeVersion: 3 });
    // Buying a listing empties a place, so the day-3 delivery names a new specimen.
    next = applyCommand(next, { type: 'buy-listing', listingId: world.shop.listings[0].id, tankId: 'tank-1', timestamp: NOW });
    next = applyCommand(next, pair);
    let tick = 0;
    for (let day = 0; day < 10 && next.clutches[0].stage === 'courting'; day++) { next = advanceWorld(next, tick, tick + DAY); tick += DAY; }
    next = advanceWorld(next, tick, tick + 6 * DAY);
    expect(next.clutches[0].stage).not.toBe('courting');
    expect(next.fish.length).toBe(6 + 20 + 1 + 1 + 20);
    expect(next.shop.nextListing).toBeGreaterThan(world.shop.nextListing);

    for (const name of names(next).slice(6)) expect(name).not.toMatch(NUMBERED);
    const everyName = [...names(next), ...next.shop.listings.map(listing => listing.name)];
    expect(new Set(everyName).size).toBe(everyName.length);
    expect(decodeSave(JSON.stringify(next))).toEqual(next);
  });

  it('loads saves named under an older model without replaying their names, then names later fish truthfully', () => {
    let runtime = createRuntime(createWorld(NOW), 'adr056-names');
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'buy', tankId: 'tank-1', timestamp: NOW, genomeVersion: 3 }, 5));
    runtime = executeCommand(runtime, commandEnvelope(runtime, cross, 10));
    // The same journal as an older build stored it: numbered names in the fish and in the ledger text.
    const stored = JSON.parse(JSON.stringify(runtime));
    stored.world.fish[6].name = 'Newcomer 7';
    stored.world.ledger.entries.at(-1).detail = 'Newcomer 7';
    stored.world.fish.slice(7).forEach((member: Fish, i: number) => { member.name = `Fry ${i + 8}`; });
    // Under the current model, names are part of what the journal proves.
    expect(() => decodeRuntime(JSON.stringify(stored))).toThrow('replay');

    for (const naming of [undefined, 1, 2]) {
      const older = structuredClone(stored);
      for (const snapshot of [older.world, older.checkpoint.world]) { snapshot.version = 7; snapshot.tanks.forEach((tank: { decorations?: unknown }) => { delete tank.decorations; }); if (naming === undefined) delete snapshot.naming; else snapshot.naming = naming; }
      const decoded = decodeRuntime(JSON.stringify(older));
      expect(names(decoded.world)).toEqual(names(stored.world));
      expect([decoded.world.naming, decoded.checkpoint.world.naming, decoded.events.length]).toEqual([NAMING_MODEL, NAMING_MODEL, 0]);
      // Anything other than names must still agree with the journal.
      older.world.fish[7].genome.maternal[0] = 5 - older.world.fish[7].genome.maternal[0];
      expect(() => decodeRuntime(JSON.stringify(older))).toThrow('replay');

      const after = executeCommand(decoded, commandEnvelope(decoded, { ...cross, tankId: 'tank-1' }, 20));
      for (const name of names(after.world).slice(27)) expect(name).not.toMatch(NUMBERED);
      expect(decodeRuntime(JSON.stringify(after))).toEqual(after);
    }
  });
});
