import { z } from 'zod';
import { MAX_DECORATIONS } from './tankManagement';

const decorationSchema = z.object({
  id: z.string().regex(/^DC-\d{1,12}$/), kind: z.enum(['cover', 'rock']),
  x: z.number().min(0.1).max(0.9), y: z.number().min(0.2).max(0.85),
  scale: z.number().min(0.5).max(1.25), rotation: z.number().min(0).max(360),
}).strict();
export const savedDecorationsSchema = z.array(decorationSchema).max(MAX_DECORATIONS);
