import type { Fish } from '../core/types';

export const MOTION_PROTOCOL = 1;
export const TRANSFORM_STRIDE = 4; // x, y, vx, vy as Float32 values in stable entity order.

export type ToMotionWorker =
  | { type: 'initialize'; protocol: 1; fish: Fish[]; tick: number; speed: 0 | 1 | 2 | 4 }
  | { type: 'synchronize'; protocol: 1; fish: Fish[] }
  | { type: 'playback'; protocol: 1; speed: 0 | 1 | 2 | 4 }
  | { type: 'feed'; protocol: 1 }
  | { type: 'benchmark'; protocol: 1; requestId: string; steps: number }
  | { type: 'simulate-fault'; protocol: 1 }
  | { type: 'shutdown'; protocol: 1 };

export type FromMotionWorker =
  | { type: 'ready'; protocol: 1; ids: string[]; tick: number }
  | { type: 'entities'; protocol: 1; ids: string[] }
  | { type: 'frame'; protocol: 1; tick: number; transforms: Float32Array; stepMs: number }
  | { type: 'benchmark'; protocol: 1; requestId: string; fish: number; steps: number; workerMs: number }
  | { type: 'fault'; protocol: 1; code: string; message: string; recoverable: boolean };
