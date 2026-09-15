import type { Footprint } from './footprints';
import type { Fish } from '../core/types';

/** Protocol 3 (FS-503) carries placed footprints and preserves them through worker recovery. */
export const MOTION_PROTOCOL = 3;
export const TRANSFORM_STRIDE = 4; // x, y, vx, vy as Float32 values in stable entity order.
export type PlaybackSpeed = 0 | 1 | 2 | 4;

export type ToMotionWorker =
  | { type: 'initialize'; protocol: 3; fish: Fish[]; tick: number; speed: PlaybackSpeed; planted: boolean; footprints?: readonly Footprint[] }
  | { type: 'synchronize'; protocol: 3; fish: Fish[] }
  | { type: 'playback'; protocol: 3; speed: PlaybackSpeed }
  | { type: 'environment'; protocol: 3; planted: boolean; footprints?: readonly Footprint[] }
  | { type: 'feed'; protocol: 3 }
  | { type: 'startle'; protocol: 3; x: number; y: number }
  | { type: 'benchmark'; protocol: 3; requestId: string; steps: number }
  | { type: 'simulate-fault'; protocol: 3 }
  | { type: 'shutdown'; protocol: 3 };

/**
 * Frames share the entity order announced by ready/entities. `states` index BEHAVIOR_STATES, `reasons` are REASONS
 * bitmasks, `leaders` index the followed entity or −1, and `food` holds pellet x/y pairs.
 */
export type FromMotionWorker =
  | { type: 'ready'; protocol: 3; ids: string[]; tick: number }
  | { type: 'entities'; protocol: 3; ids: string[] }
  | { type: 'frame'; protocol: 3; tick: number; transforms: Float32Array; states: Uint8Array; reasons: Uint8Array; leaders: Int16Array; food: Float32Array; stepMs: number }
  | { type: 'benchmark'; protocol: 3; requestId: string; fish: number; steps: number; workerMs: number }
  | { type: 'fault'; protocol: 3; code: string; message: string; recoverable: boolean };
