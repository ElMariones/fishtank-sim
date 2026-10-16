import type { Species } from './types';

/** Display words for each species, so text never falls back to "koi" for an animal that is not one. */
export const SPECIES_INFO: Record<Species, { one: string; many: string; a: string; title: string; titles: string; latin: string }> = {
  koi: { one: 'koi', many: 'koi', a: 'a koi', title: 'Koi', titles: 'Koi', latin: 'Koi · Cyprinus rubrofuscus' },
  axolotl: { one: 'axolotl', many: 'axolotls', a: 'an axolotl', title: 'Axolotl', titles: 'Axolotls', latin: 'Axolotl · Ambystoma mexicanum' },
  goldfish: { one: 'goldfish', many: 'goldfish', a: 'a goldfish', title: 'Goldfish', titles: 'Goldfish', latin: 'Goldfish · Carassius auratus' },
};
