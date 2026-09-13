import { clamp } from './random';
import type { Phenotype } from './types';

/** Visible descriptors normalized against their theoretical development ranges (0 = minimum, 1 = maximum). */
export const VISUAL_DESCRIPTORS = [
  { key: 'length', label: 'Body length', min: 0.7, max: 1.6 },
  { key: 'depth', label: 'Body depth', min: 0.12, max: 0.6 },
  { key: 'head', label: 'Head size', min: 0.13, max: 0.44 },
  { key: 'snout', label: 'Snout length', min: 0.015, max: 0.135 },
  { key: 'eye', label: 'Eye size', min: 0.015, max: 0.06 },
  { key: 'tail', label: 'Tail length', min: 0.091, max: 1.026 },
  { key: 'spread', label: 'Tail spread', min: 0.12, max: 0.54 },
  { key: 'fork', label: 'Tail fork', min: 0, max: 0.75 },
  { key: 'dorsal', label: 'Dorsal height', min: 0.02275, max: 0.37125 },
  { key: 'pectoral', label: 'Pectoral length', min: 0.039, max: 0.432 },
  { key: 'red', label: 'Warm pigment', min: 0, max: 1 },
  { key: 'black', label: 'Dark pigment', min: 0, max: 1 },
  { key: 'frequency', label: 'Pattern count', min: 3, max: 16 },
  { key: 'patternScale', label: 'Pattern scale', min: 0.05, max: 0.2 },
] as const;

export type VisualDescriptorKey = typeof VISUAL_DESCRIPTORS[number]['key'];
export type NormalizedVisualDescriptors = Record<VisualDescriptorKey, number>;

export function measureDescriptors(phenotype: Phenotype): NormalizedVisualDescriptors {
  return Object.fromEntries(VISUAL_DESCRIPTORS.map(({ key, min, max }) => [
    key,
    clamp((phenotype[key] - min) / (max - min)),
  ])) as NormalizedVisualDescriptors;
}
