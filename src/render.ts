import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { resolve } from 'node:path';
import type { Snapshot } from './data.ts';
import { LEVELS } from './data.ts';
import { CELL, HEIGHT, WIDTH, cells } from './layout.ts';
import type { Layout } from './layout.ts';
import { position } from './timeline.ts';
export const THEMES = {
  light: { bg: '#ffffff', grid: '#f3f5f6', ink: '#24292f', muted: '#57606a', guide: '#eaeef2', colors: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'] },
  dark: { bg: '#0d1117', grid: '#141b23', ink: '#e6edf3', muted: '#8b949e', guide: '#212a35', colors: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'] },
};
export type Theme = keyof typeof THEMES;
if (!GlobalFonts.registerFromPath(resolve(import.meta.dirname, '../assets/fonts/IBMPlexMono-Regular.ttf'), 'Pixel Mono')) throw new Error('Bundled IBM Plex Mono font could not be loaded');
export function makeRenderer(snapshot: Snapshot, layout: Layout, theme: Theme) {
  const palette = THEMES[theme], scale = layout.scale;
  const canvas = createCanvas(WIDTH * scale, HEIGHT * scale);
  const ctx = canvas.getContext('2d');
  const first = snapshot.days[0].date, last = snapshot.days.at(-1)!.date;
  return (time: number) => {
    ctx.resetTransform(); ctx.scale(scale, scale);
    ctx.fillStyle = palette.bg; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = palette.grid;
    for (let x = 20; x < WIDTH; x += 20) ctx.fillRect(x, 0, 0.5, HEIGHT);
    for (let y = 20; y < HEIGHT; y += 20) ctx.fillRect(0, y, WIDTH, 0.5);
    ctx.textAlign = 'center'; ctx.font = '12px "Pixel Mono"'; ctx.fillStyle = palette.muted;
    ctx.fillText('C O L I N  /  A  Y E A R  I N  P I X E L S', WIDTH / 2, 48);
    if (layout.sparse) {
      ctx.strokeStyle = palette.guide; ctx.lineWidth = 0.7;
      for (const c of cells) ctx.strokeRect(c.x + 1, c.y + 1, CELL - 2, CELL - 2);
    }
    if (snapshot.totalContributions === 0) {
      ctx.font = '22px "Pixel Mono"'; ctx.fillStyle = palette.ink;
      ctx.fillText('No contributions in this period', WIDTH / 2, 180);
    }
    // Keep particles out of the quiet header and footer bands.
    ctx.save(); ctx.beginPath(); ctx.rect(0, 65, WIDTH, 218); ctx.clip();
    for (const p of layout.particles) {
      const pos = position(p, time);
      ctx.fillStyle = palette.colors[LEVELS.indexOf(p.level)];
      // Integer device-pixel edges keep GIF palettes clean and the pixels crisp.
      ctx.fillRect(Math.round(pos.x * scale) / scale, Math.round(pos.y * scale) / scale, Math.max(1, Math.round(p.size * scale)) / scale, Math.max(1, Math.round(p.size * scale)) / scale);
    }
    ctx.restore();
    ctx.fillStyle = palette.ink; ctx.font = '17px "Pixel Mono"';
    ctx.fillText(`${snapshot.totalContributions.toLocaleString('en-US')} contributions · ${first} — ${last}`, WIDTH / 2, 310);
    ctx.font = '13px "Pixel Mono"'; ctx.fillStyle = palette.muted;
    ctx.fillText(`1 pixel = 1 contribution  /  Updated ${snapshot.fetchedAt.slice(0, 10)}`, WIDTH / 2, 335);
    return canvas;
  };
}
