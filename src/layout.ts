import type { Level, Snapshot } from './data.ts';

// Hand-drawn, deliberately lowercase o/l/i/n. Blank rows preserve the i dot.
export const GLYPHS = [
  ['01111', '11000', '11000', '11000', '11000', '11000', '01111'],
  ['00000', '00000', '01110', '11011', '11011', '11011', '01110'],
  ['110', '010', '010', '010', '010', '010', '111'],
  ['010', '000', '110', '010', '010', '010', '111'],
  ['00000', '00000', '11110', '11001', '11001', '11001', '11001'],
];
export const WIDTH = 960, HEIGHT = 360, CELL = 23, TOP = 102;
export interface Cell { x: number; y: number; glyph: number }
export const cells: Cell[] = [];
const textWidth = (GLYPHS.reduce((n, g) => n + g[0].length, 0) + 4 * 2) * CELL;
let cursor = (WIDTH - textWidth) / 2;
GLYPHS.forEach((glyph, index) => {
  glyph.forEach((row, y) => [...row].forEach((pixel, x) => { if (pixel === '1') cells.push({ x: cursor + x * CELL, y: TOP + y * CELL, glyph: index }); }));
  cursor += (glyph[0].length + 2) * CELL;
});
export function random(seed: number): () => number {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export interface Particle { id: number; x: number; y: number; size: number; level: Level; date: string; delay: number; fall: number; exit: number; startY: number; cell: number }
export interface Layout { particles: Particle[]; scale: number; sparse: boolean }
export function makeLayout(snapshot: Snapshot): Layout {
  const n = snapshot.totalContributions;
  const seed = snapshot.days.reduce((v, d) => Math.imul(v ^ d.contributionCount, 16777619), 2166136261);
  const rng = random(seed);
  const contributions = snapshot.days.flatMap(d => Array.from({ length: d.contributionCount }, () => ({ level: d.contributionLevel, date: d.date })));
  // Shuffle provenance only: color remains the source day's real level.
  for (let i = contributions.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [contributions[i], contributions[j]] = [contributions[j], contributions[i]]; }
  // Round-robin across glyphs covers all five letters even with sparse input.
  const glyphCells = GLYPHS.map((_, i) => cells.map((c, index) => ({ ...c, index })).filter(c => c.glyph === i));
  const order: number[] = [];
  for (let row = 0; glyphCells.some(g => row < g.length); row++) for (const g of glyphCells) if (g[row]) order.push(g[row].index);
  const allocations = cells.map(() => 0);
  for (let i = 0; i < n; i++) allocations[order[i % order.length]]++;
  const particles: Particle[] = [];
  cells.forEach((cell, cellIndex) => {
    const count = allocations[cellIndex];
    if (!count) return;
    const grid = Math.ceil(Math.sqrt(count));
    const pitch = CELL / grid;
    // Spread incomplete rows across the cell instead of a solid corner cluster.
    for (let i = 0; i < count; i++) {
      const slot = Math.floor((i + 0.5) * grid * grid / count);
      const id = particles.length;
      particles.push({ id, cell: cellIndex, x: cell.x + (slot % grid) * pitch + pitch * 0.06,
        y: cell.y + Math.floor(slot / grid) * pitch + pitch * 0.06, size: pitch * 0.88,
        ...contributions[id], delay: 0, fall: 0.95, exit: 0, startY: -30 });
    }
  });
  // A shared arrival function by height: lower targets always arrive first.
  // All particles descend vertically, so settled upper rows never obstruct lower rows.
  particles.forEach(p => {
    const columnWave = 0.26 * (0.5 + 0.5 * Math.sin(p.x / 58));
    p.delay = 0.1 + (TOP + 7 * CELL - p.y) / (7 * CELL) * 2.45 + columnWave;
    p.exit = 8.04 + (TOP + 7 * CELL - p.y) / (7 * CELL) * 0.55 + columnWave * 0.3;
  });
  const minSize = particles.reduce((smallest, p) => Math.min(smallest, p.size), CELL);
  return { particles, scale: Math.max(1, Math.ceil(2 / minSize)), sparse: n > 0 && n < cells.length };
}
