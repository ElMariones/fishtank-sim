import { daysToHatch, lifeStage, type LifeStage } from '../core/development';
import { metabolicPotential } from '../core/genetics';
import type { Fish } from '../core/types';

export const STAGE_LABELS: Record<LifeStage, string> = { egg: 'Egg', fry: 'Fry', juvenile: 'Juvenile', adult: 'Adult', elderly: 'Elderly' };

/** Current stage and size beside the genetic adult length, which remains only a potential (FS-302). */
export function lifeSummary(fish: Fish): string {
  const potential = metabolicPotential(fish.genome), stage = lifeStage(fish.life, potential);
  if (stage === 'egg') {
    const days = daysToHatch(fish.life);
    return `Egg · hatches in ${days} game day${days === 1 ? '' : 's'}`;
  }
  const length = fish.life.lengthCm;
  return `${STAGE_LABELS[stage]} · ${length.toFixed(length < 10 ? 1 : 0)} of ${potential.adultLengthCm.toFixed(0)} cm`;
}

/** Share of the genetic adult length reached so far, for growth bars. */
export function growthShare(fish: Fish): number {
  const potential = metabolicPotential(fish.genome).adultLengthCm;
  return potential > 0 ? Math.max(0, Math.min(1, fish.life.lengthCm / potential)) : 0;
}

export function stageOf(fish: Fish): LifeStage {
  return lifeStage(fish.life, metabolicPotential(fish.genome));
}
