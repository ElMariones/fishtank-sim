import type { Fish } from '../core/types';

/** Protocol 2 (FS-303) adds behavior state, reasons, leaders, pellets, the planted environment and startles. */
export const MOTION_PROTOCOL = 2;
export const TRANSFORM_STRIDE = 4; // x, y, vx, vy as Float32 values in stable entity order.
export type PlaybackSpeed = 0 | 1 | 2 | 4;

export type ToMotionWorker =
  | { type: 'initialize'; protocol: 2; fish: Fish[]; tick: number; speed: PlaybackSpeed; planted: boolean }
  | { type: 'synchronize'; protocol: 2; fish: Fish[] }
  | { type: 'playback'; protocol: 2; speed: PlaybackSpeed }
  | { type: 'environment'; protocol: 2; planted: boolean }
  | { type: 'feed'; protocol: 2 }
  | { type: 'startle'; protocol: 2; x: number; y: number }
  | { type: 'benchmark'; protocol: 2; requestId: string; steps: number }
  | { type: 'simulate-fault'; protocol: 2 }
  | { type: 'shutdown'; protocol: 2 };

/**
 * Frames share the entity order announced by ready/entities. `states` index BEHAVIOR_STATES, `reasons` are REASONS
 * bitmasks, `leaders` index the followed entity or −1, and `food` holds pellet x/y pairs.
 */
export type FromMotionWorker =
  | { type: 'ready'; protocol: 2; ids: string[]; tick: number }
  | { type: 'entities'; protocol: 2; ids: string[] }
  | { type: 'frame'; protocol: 2; tick: number; transforms: Float32Array; states: Uint8Array; reasons: Uint8Array; leaders: Int16Array; food: Float32Array; stepMs: number }
  | { type: 'benchmark'; protocol: 2; requestId: string; fish: number; steps: number; workerMs: number }
  | { type: 'fault'; protocol: 2; code: string; message: string; recoverable: boolean };
