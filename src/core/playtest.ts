import { pairingBlockers, reservedPlaces } from './breeding';
import { careSettings } from './care';
import { ADULT_FROM, isEgg } from './development';
import { metabolicPotential } from './genetics';
import { advanceWorld } from './habitat';
import { missingSexes, RELIEF_THRESHOLD, reliefDestination, reliefStatus } from './recovery';
import type { Fish, World } from './types';
import { TICKS_PER_GAME_DAY } from './water';
import { applyCommand, MAX_LIVING, MAX_RECORDS, type Command } from './world';

export type PairingRoute = { world: World; days: number; commands: Command['type'][] };

/**
 * No-softlock probe (FS-504, shared with FS-505). Reaches an accepted normal pairing using only what a player without
 * spare credits can do: cancel courtships, rehome and move fish, choose free care settings, wait, and take the koi rescue
 * or founder stock the credits already cover. Throws when no pairing is reached within `maxDays` game days.
 */
export function routeToPairing(start: World, startTick: number, maxDays = 150, timestamp = '2026-09-15T12:00:00.000Z'): PairingRoute {
  const DAY = TICKS_PER_GAME_DAY, limits = { maxLiving: MAX_LIVING, maxRecords: MAX_RECORDS };
  let world = start, tick = startTick, home: string | null = null;
  const commands: Command['type'][] = [];
  const run = (command: Command) => { world = applyCommand(world, command); commands.push(command.type); };
  const wait = () => { world = advanceWorld(world, tick, tick + DAY); tick += DAY; };
  const living = () => world.fish.filter(f => f.status === 'living');
  const free = (tankId: string) => world.tanks.find(t => t.id === tankId)!.capacity - living().filter(f => f.tankId === tankId).length - reservedPlaces(world, tankId);
  const promise = (f: Fish) => (isEgg(f.life) ? 0 : 2) + (f.life.lengthCm >= ADULT_FROM * metabolicPotential(f.genome).adultLengthCm ? 2 : 0) + f.life.condition;
  const best = (sex: Fish['sex']) => living().filter(f => f.sex === sex).sort((a, b) => promise(b) - promise(a))[0];
  /** Rehoming is free: release hatched fish from a tank until it has `needed` places, keeping the most promising breeders. */
  const makeRoom = (tankId: string, needed: number) => {
    const keep = new Set([best('F')?.id, best('M')?.id]);
    const spare = living().filter(f => f.tankId === tankId && !isEgg(f.life) && !keep.has(f.id)).map(f => f.id);
    const count = Math.min(spare.length, needed - free(tankId));
    if (count > 0) run({ type: 'rehome-batch', fishIds: spare.slice(0, count) });
    return free(tankId) >= needed;
  };
  for (const clutch of world.clutches) if (clutch.stage === 'courting') run({ type: 'cancel-clutch', clutchId: clutch.id });
  while (tick - startTick < maxDays * DAY) {
    const missing = missingSexes(world);
    if (missing.length) {
      if (reliefStatus(world).eligible) {
        const tankId = reliefDestination(world, missing.length) ?? (makeRoom('tank-1', missing.length) ? 'tank-1' : null);
        if (tankId) { run({ type: 'claim-relief', tankId, timestamp, genomeVersion: 2 }); continue; }
      } else if (world.credits >= RELIEF_THRESHOLD * missing.length) {
        const listing = world.shop.listings.find(entry => entry.sex === missing[0] && entry.price <= world.credits);
        const tankId = listing ? reliefDestination(world, 1) ?? (makeRoom('tank-1', 1) ? 'tank-1' : null) : null;
        if (listing && tankId) { run({ type: 'buy-listing', listingId: listing.id, tankId, timestamp }); continue; }
      }
      wait();
      continue;
    }
    const mother = best('F'), father = best('M');
    if (!isEgg(mother.life) && !isEgg(father.life)) {
      // The tank with the cleanest water becomes home: move the pair in, release everyone else there, measured rations at 22 °C.
      home ??= [...world.tanks].sort((a, b) => a.water.ammoniaMgL - b.water.ammoniaMgL)[0].id;
      for (const parent of [mother, father]) if (parent.tankId !== home && makeRoom(home, 1)) run({ type: 'move', fishId: parent.id, tankId: home });
      makeRoom(home, world.tanks.find(t => t.id === home)!.capacity);
      const settings = careSettings(world.tanks.find(t => t.id === home)!);
      if (settings.ration !== 'measured' || settings.targetC !== 22)
        run({ type: 'set-care', tankId: home, ration: 'measured', filterTier: settings.filterTier, aerationTier: settings.aerationTier, targetC: 22 });
      const request = { motherId: mother.id, fatherId: father.id, nurseryId: home, size: 8 as const };
      if (!pairingBlockers(world, request, limits).length) {
        run({ type: 'pair', ...request, timestamp, genomeVersion: 2 });
        return { world, days: Math.ceil((tick - startTick) / DAY), commands };
      }
    }
    wait();
  }
  throw new Error(`No route back to a breeding pair within ${maxDays} game days.`);
}
