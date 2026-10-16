import { useLayoutEffect, useState, type RefObject } from 'react';

export type Anchor = { x: number; y: number; width: number; height: number };
export type Placement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'right-start' | 'left-start' | 'bottom' | 'top';

export const anchorOf = (element: Element): Anchor => {
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
};
export const pointAnchor = (x: number, y: number): Anchor => ({ x, y, width: 0, height: 0 });

const GAP = 6, MARGIN = 8;

/**
 * Places a floating element next to an anchor in viewport coordinates, flipping to the other side when it would
 * overflow and clamping it inside the window. Returns the side it settled on, for the entry animation's origin.
 */
export function useAnchoredPosition(floating: RefObject<HTMLElement | null>, anchor: Anchor | null, placement: Placement = 'bottom-start') {
  const [position, setPosition] = useState<{ left: number; top: number; side: string; ready: boolean }>({ left: -9999, top: -9999, side: 'bottom', ready: false });
  useLayoutEffect(() => {
    const element = floating.current;
    if (!element || !anchor) return;
    const place = () => {
      const width = element.offsetWidth, height = element.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
      let [side, align] = placement.split('-') as [string, string | undefined];
      let left = 0, top = 0;
      const horizontal = () => {
        if (align === 'end') left = anchor.x + anchor.width - width;
        else if (align === 'start') left = anchor.x;
        else left = anchor.x + anchor.width / 2 - width / 2;
      };
      if (side === 'bottom' || side === 'top') {
        horizontal();
        top = side === 'bottom' ? anchor.y + anchor.height + GAP : anchor.y - height - GAP;
        if (side === 'bottom' && top + height > vh - MARGIN && anchor.y - height - GAP > MARGIN) { side = 'top'; top = anchor.y - height - GAP; }
        else if (side === 'top' && top < MARGIN && anchor.y + anchor.height + GAP + height < vh - MARGIN) { side = 'bottom'; top = anchor.y + anchor.height + GAP; }
      } else {
        top = anchor.y - 5;
        left = side === 'right' ? anchor.x + anchor.width + 2 : anchor.x - width - 2;
        if (side === 'right' && left + width > vw - MARGIN) { side = 'left'; left = anchor.x - width - 2; }
        else if (side === 'left' && left < MARGIN) { side = 'right'; left = anchor.x + anchor.width + 2; }
      }
      left = Math.max(MARGIN, Math.min(left, vw - width - MARGIN));
      top = Math.max(MARGIN, Math.min(top, vh - height - MARGIN));
      setPosition({ left, top, side, ready: true });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [floating, anchor?.x, anchor?.y, anchor?.width, anchor?.height, placement]);
  return position;
}

/** Closes a floating layer on a pointer press outside it (and outside its trigger), or when the page scrolls. */
export function useDismiss(open: boolean, inside: () => (Element | null | undefined)[], onClose: () => void, closeOnScroll = true) {
  useLayoutEffect(() => {
    if (!open) return;
    const press = (event: PointerEvent) => {
      const target = event.target as Node;
      if (inside().some(element => element?.contains(target))) return;
      onClose();
    };
    const scroll = (event: Event) => {
      const target = event.target as Node;
      if (inside().some(element => element?.contains(target))) return;
      onClose();
    };
    document.addEventListener('pointerdown', press, true);
    if (closeOnScroll) window.addEventListener('scroll', scroll, true);
    return () => { document.removeEventListener('pointerdown', press, true); window.removeEventListener('scroll', scroll, true); };
  }, [open]);
}
