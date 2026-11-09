/**
 * Shared geometry for the original NutriPet cat art (viewBox 0 0 200 200). Stage SVGs in public/pet
 * are generated from these numbers (scripts/generate-pet-art.ts), and accessories are positioned from
 * the same anchors: head center (hx, hy) and head radius (r).
 */
export type Stage = 'newborn' | 'young' | 'adolescent' | 'adult' | 'special';

export interface StageGeometry {
  hx: number;
  hy: number;
  r: number;
  bx: number;
  by: number;
  brx: number;
  bry: number;
}

export const GEOMETRY: Record<Stage, StageGeometry> = {
  newborn: { hx: 100, hy: 108, r: 38, bx: 100, by: 156, brx: 44, bry: 30 },
  young: { hx: 100, hy: 98, r: 40, bx: 100, by: 152, brx: 52, bry: 36 },
  adolescent: { hx: 100, hy: 88, r: 40, bx: 100, by: 148, brx: 56, bry: 42 },
  adult: { hx: 100, hy: 78, r: 42, bx: 100, by: 144, brx: 62, bry: 48 },
  special: { hx: 100, hy: 78, r: 42, bx: 100, by: 144, brx: 62, bry: 48 },
};

export type AccessoryId = 'gorro' | 'bufanda' | 'mono' | 'gafas' | 'corona';

/** Placement box (x, y, width, height) of an accessory overlay for a stage. Accessory art uses a 100×60 viewBox. */
export function accessoryBox(stage: Stage, id: AccessoryId): { x: number; y: number; w: number; h: number } {
  const g = GEOMETRY[stage];
  switch (id) {
    case 'gorro':
      return { x: g.hx - g.r * 0.85, y: g.hy - g.r * 1.5, w: g.r * 1.7, h: g.r * 1.02 };
    case 'corona':
      return { x: g.hx - g.r * 0.6, y: g.hy - g.r * 1.55, w: g.r * 1.2, h: g.r * 0.72 };
    case 'gafas':
      return { x: g.hx - g.r * 0.78, y: g.hy - g.r * 0.32, w: g.r * 1.56, h: g.r * 0.94 * 0.6 };
    case 'bufanda':
      return { x: g.hx - g.r * 0.95, y: g.hy + g.r * 0.68, w: g.r * 1.9, h: g.r * 1.14 * 0.6 };
    case 'mono':
      return { x: g.hx + g.r * 0.25, y: g.hy - g.r * 1.12, w: g.r * 0.8, h: g.r * 0.48 };
  }
}
