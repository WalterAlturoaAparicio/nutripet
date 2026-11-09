/**
 * Generates the original NutriPet cat illustrations (public/pet/*.svg) from src/ui/pet/geometry.ts.
 * Friendly flat style, one palette, a shared 200×200 viewBox so accessories align by anchor.
 *
 *   pnpm tsx scripts/generate-pet-art.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { GEOMETRY, type Stage } from '../src/ui/pet/geometry';

const C = { fur: '#f2a65a', furDark: '#d9853b', belly: '#fde3c3', ink: '#3b2f2f', blush: '#f6a5a5', nose: '#e57a7a' };
const SPECIAL = { fur: '#8f7ae6', furDark: '#6a54c9', belly: '#e6defc' };

function cat(stage: Stage): string {
  const g = GEOMETRY[stage];
  const pal = stage === 'special' ? { ...C, ...SPECIAL } : C;
  const { hx, hy, r, bx, by, brx, bry } = g;
  const eyeR = stage === 'newborn' ? r * 0.17 : stage === 'young' ? r * 0.15 : r * 0.13;
  const eyeDx = r * 0.38;
  const eyeY = hy - r * 0.02;
  const ear = (side: -1 | 1) => {
    const x0 = hx + side * r * 0.85;
    const x1 = hx + side * r * 0.55;
    const x2 = hx + side * r * 0.15;
    const yTop = hy - r * (stage === 'newborn' ? 1.05 : 1.25);
    return `<path d="M${x0} ${hy - r * 0.35} L${x1} ${yTop} L${x2} ${hy - r * 0.82} Z" fill="${pal.fur}"/>
    <path d="M${hx + side * r * 0.72} ${hy - r * 0.45} L${x1} ${yTop + r * 0.22} L${hx + side * r * 0.3} ${hy - r * 0.78} Z" fill="${pal.blush}" opacity="0.7"/>`;
  };
  const stripes =
    stage === 'adolescent' || stage === 'adult'
      ? [-0.35, 0, 0.35]
          .map((dx) => `<path d="M${hx + dx * r} ${hy - r * 0.98} q ${r * 0.05} ${r * 0.18} 0 ${r * 0.32}" stroke="${pal.furDark}" stroke-width="${r * 0.08}" stroke-linecap="round" fill="none"/>`)
          .join('')
      : '';
  const tailLen = stage === 'newborn' ? 0.7 : 1;
  const tail = `<path d="M${bx + brx * 0.8} ${by + bry * 0.2} q ${brx * 0.7 * tailLen} ${-bry * 0.3} ${brx * 0.45 * tailLen} ${-bry * 1.3 * tailLen}" stroke="${pal.fur}" stroke-width="${r * 0.28}" stroke-linecap="round" fill="none"/>`;
  const aura =
    stage === 'special'
      ? `<circle cx="100" cy="110" r="88" fill="#f5f0ff"/>
  ${[
    [38, 40],
    [160, 52],
    [30, 130],
    [170, 140],
    [100, 18],
  ]
    .map(([x, y]) => `<path d="M${x} ${y! - 7} L${x! + 2} ${y! - 2} L${x! + 7} ${y} L${x! + 2} ${y! + 2} L${x} ${y! + 7} L${x! - 2} ${y! + 2} L${x! - 7} ${y} L${x! - 2} ${y! - 2} Z" fill="#f4c542"/>`)
    .join('\n  ')}`
      : '';
  const paws =
    stage === 'newborn'
      ? ''
      : [-0.45, 0.45].map((dx) => `<ellipse cx="${bx + dx * brx}" cy="${by + bry * 0.88}" rx="${brx * 0.2}" ry="${bry * 0.16}" fill="${pal.belly}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="${stage}">
  <!-- NutriPet original artwork. Anchors: head (${hx}, ${hy}) r=${r}; body (${bx}, ${by}) ${brx}×${bry}. -->
  ${aura}
  <ellipse cx="100" cy="${by + bry + 4}" rx="${brx * 1.05}" ry="6" fill="#000" opacity="0.08"/>
  ${tail}
  <ellipse cx="${bx}" cy="${by}" rx="${brx}" ry="${bry}" fill="${pal.fur}"/>
  <ellipse cx="${bx}" cy="${by + bry * 0.15}" rx="${brx * 0.55}" ry="${bry * 0.7}" fill="${pal.belly}"/>
  ${paws}
  ${ear(-1)}
  ${ear(1)}
  <circle cx="${hx}" cy="${hy}" r="${r}" fill="${pal.fur}"/>
  ${stripes}
  <ellipse cx="${hx}" cy="${hy + r * 0.35}" rx="${r * 0.5}" ry="${r * 0.36}" fill="${pal.belly}"/>
  <g class="pet-eyes">
    <circle cx="${hx - eyeDx}" cy="${eyeY}" r="${eyeR}" fill="${pal.ink}"/>
    <circle cx="${hx + eyeDx}" cy="${eyeY}" r="${eyeR}" fill="${pal.ink}"/>
    <circle cx="${hx - eyeDx + eyeR * 0.35}" cy="${eyeY - eyeR * 0.35}" r="${eyeR * 0.33}" fill="#fff"/>
    <circle cx="${hx + eyeDx + eyeR * 0.35}" cy="${eyeY - eyeR * 0.35}" r="${eyeR * 0.33}" fill="#fff"/>
  </g>
  <ellipse cx="${hx - r * 0.55}" cy="${hy + r * 0.25}" rx="${r * 0.13}" ry="${r * 0.08}" fill="${pal.blush}" opacity="0.8"/>
  <ellipse cx="${hx + r * 0.55}" cy="${hy + r * 0.25}" rx="${r * 0.13}" ry="${r * 0.08}" fill="${pal.blush}" opacity="0.8"/>
  <path d="M${hx - r * 0.07} ${hy + r * 0.2} h${r * 0.14} l${-r * 0.07} ${r * 0.08} z" fill="${pal.nose}"/>
  <path d="M${hx} ${hy + r * 0.28} q ${-r * 0.1} ${r * 0.14} ${-r * 0.2} ${r * 0.04} M${hx} ${hy + r * 0.28} q ${r * 0.1} ${r * 0.14} ${r * 0.2} ${r * 0.04}" stroke="${pal.ink}" stroke-width="${r * 0.04}" fill="none" stroke-linecap="round"/>
  <path d="M${hx - r * 0.45} ${hy + r * 0.32} h${-r * 0.4} M${hx - r * 0.45} ${hy + r * 0.42} l${-r * 0.38} ${r * 0.08} M${hx + r * 0.45} ${hy + r * 0.32} h${r * 0.4} M${hx + r * 0.45} ${hy + r * 0.42} l${r * 0.38} ${r * 0.08}" stroke="${pal.ink}" stroke-width="${r * 0.025}" opacity="0.5" stroke-linecap="round"/>
</svg>
`;
}

// Accessories use a 100×60 viewBox and are scaled into accessoryBox().
const ACCESSORIES: Record<string, string> = {
  gorro: `<path d="M12 52 Q50 -6 88 52 Z" fill="#e84a5f"/><rect x="6" y="46" width="88" height="12" rx="6" fill="#fff"/><circle cx="50" cy="6" r="7" fill="#fff"/>`,
  corona: `<path d="M8 56 L14 14 L32 34 L50 4 L68 34 L86 14 L92 56 Z" fill="#f4c542" stroke="#d9a520" stroke-width="3" stroke-linejoin="round"/><circle cx="50" cy="40" r="5" fill="#e84a5f"/><circle cx="28" cy="44" r="4" fill="#4f5bd5"/><circle cx="72" cy="44" r="4" fill="#0f9d76"/>`,
  gafas: `<circle cx="27" cy="30" r="18" fill="#bfe3ff" fill-opacity="0.35" stroke="#3b2f2f" stroke-width="5"/><circle cx="73" cy="30" r="18" fill="#bfe3ff" fill-opacity="0.35" stroke="#3b2f2f" stroke-width="5"/><path d="M45 28 Q50 22 55 28" stroke="#3b2f2f" stroke-width="5" fill="none"/>`,
  bufanda: `<path d="M4 14 Q50 34 96 14 L96 30 Q50 50 4 30 Z" fill="#4f5bd5"/><path d="M64 30 L70 58 L84 54 L78 26 Z" fill="#4f5bd5"/><path d="M20 22 v10 M36 27 v10 M52 29 v10 M68 26 v10" stroke="#fff" stroke-width="4" opacity="0.6"/>`,
  mono: `<path d="M50 30 L10 8 Q2 30 10 52 Z" fill="#f06fa8"/><path d="M50 30 L90 8 Q98 30 90 52 Z" fill="#f06fa8"/><circle cx="50" cy="30" r="10" fill="#d94d8c"/>`,
};

function main() {
  const dir = path.resolve('public/pet');
  fs.mkdirSync(dir, { recursive: true });
  for (const stage of Object.keys(GEOMETRY) as Stage[]) fs.writeFileSync(path.join(dir, `stage-${stage}.svg`), cat(stage));
  for (const [id, body] of Object.entries(ACCESSORIES)) {
    fs.writeFileSync(path.join(dir, `acc-${id}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60">\n  ${body}\n</svg>\n`);
  }
  console.log(`Arte generado en ${path.relative(process.cwd(), dir)}`);
}

main();
