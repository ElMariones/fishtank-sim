import { z } from 'zod';
import { BACKDROPS, DECOR_ITEM_IDS, DECOR_VARIANTS, LIGHTINGS, SUBSTRATES } from './aquascape';
import { MAX_DECORATIONS } from './tankManagement';

const decorationSchema = z.object({
  id: z.string().regex(/^DC-\d{1,12}$/), kind: z.enum(['cover', 'rock']),
  x: z.number().min(0.1).max(0.9), y: z.number().min(0.2).max(0.85),
  scale: z.number().min(0.5).max(1.25), rotation: z.number().min(0).max(360),
  // FS-117: catalog piece and shape variant. Absent on FS-503 layouts, which keep their original look.
  item: z.enum(DECOR_ITEM_IDS).optional(), variant: z.number().int().min(0).max(DECOR_VARIANTS - 1).optional(),
}).strict();
export const savedDecorationsSchema = z.array(decorationSchema).max(MAX_DECORATIONS);
const ids = <T extends readonly { id: string }[]>(options: T) => options.map(entry => entry.id) as [T[number]['id'], ...T[number]['id'][]];
/** FS-117 tank look. Cosmetic only; absent on tanks that never changed it. */
export const tankStyleSchema = z.object({ substrate: z.enum(ids(SUBSTRATES)), backdrop: z.enum(ids(BACKDROPS)), lighting: z.enum(ids(LIGHTINGS)) }).strict();
