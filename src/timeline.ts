import type { Particle } from './layout.ts';
export const FPS = 30, DURATION = 10;
export function position(p: Particle, time: number): { x: number; y: number } {
  if (time < p.delay) return { x: p.x, y: p.startY };
  const progress = (time - p.delay) / p.fall;
  let y = p.y;
  if (progress < 1) y = p.startY + (p.y - p.startY) * progress * progress;
  else if (progress < 1.18) {
    const bounce = (progress - 1) / 0.18;
    y -= Math.sin(bounce * Math.PI) * Math.min(2, p.size * 0.08);
  }
  if (time > p.exit) y += 720 * (time - p.exit) ** 2;
  return { x: p.x, y };
}
