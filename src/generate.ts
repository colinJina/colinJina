import { mkdir, readFile, writeFile, stat, rename, rm } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { spawn } from 'node:child_process';
import { validateSnapshot } from './data.ts';
import { makeLayout } from './layout.ts';
import { makeRenderer } from './render.ts';
import type { Theme } from './render.ts';
import { FPS, DURATION } from './timeline.ts';

const root = resolve(import.meta.dirname, '..');
const cache = join(root, '.cache');
const input = resolve(process.argv[2] ?? join(cache, 'contributions.json'));
const destination = resolve(process.argv[3] ?? join(root, 'generated'));
if (destination === root || relative(root, destination).startsWith('..') || !relative(root, destination)) throw new Error('Output must be a child directory of this repository');
const snapshot = validateSnapshot(JSON.parse(await readFile(input, 'utf8')));
const layout = makeLayout(snapshot);
if (layout.particles.length !== snapshot.totalContributions) throw new Error('Particle count mismatch');
const staging = join(cache, `render-${process.pid}`);
await mkdir(staging, { recursive: true });
const output = join(staging, 'output');
await mkdir(output);
function command(executable: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let error = '', stdout = '';
    child.stdout.on('data', chunk => { stdout = (stdout + chunk.toString()).slice(-16000); });
    child.stderr.on('data', chunk => { error = (error + chunk.toString()).slice(-8000); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(`${executable} exited ${code}: ${error}`)));
  });
}
const sizes: Record<string, number> = {};
const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH ?? ffmpeg.replace(/ffmpeg(?=\.exe$|$)/i, 'ffprobe');
await command(ffmpeg, ['-version']);
await command(ffprobe, ['-version']);
for (const theme of ['light', 'dark'] as Theme[]) {
  console.log(`Rendering ${theme}: ${layout.particles.length} particles, ${layout.scale}x resolution`);
  const frames = join(staging, theme);
  await mkdir(frames);
  const render = makeRenderer(snapshot, layout, theme);
  for (let frame = 0; frame < FPS * DURATION; frame++) {
    await writeFile(join(frames, `${String(frame).padStart(4, '0')}.png`), render(frame / FPS).toBuffer('image/png'));
  }
  const palette = join(staging, `${theme}-palette.png`);
  const sequence = join(frames, '%04d.png');
  const gif = join(output, `colin-${theme}.gif`);
  await command(ffmpeg, ['-v', 'error', '-y', '-framerate', String(FPS), '-i', sequence, '-vf', 'palettegen=max_colors=64:stats_mode=diff', '-frames:v', '1', '-update', '1', palette]);
  await command(ffmpeg, ['-v', 'error', '-y', '-framerate', String(FPS), '-i', sequence, '-i', palette, '-lavfi', 'paletteuse=dither=none:diff_mode=rectangle', '-loop', '0', gif]);
  sizes[theme] = (await stat(gif)).size;
  if (sizes[theme] > 5 * 1024 * 1024) throw new Error(`${theme} GIF exceeds 5 MiB (${sizes[theme]} bytes); previous assets preserved. Optimize export before publishing.`);
  const probe = JSON.parse(await command(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_frames,duration', '-of', 'json', gif])).streams?.[0];
  if (!probe || probe.width !== 960 * layout.scale || probe.height !== 360 * layout.scale || Number(probe.nb_frames) !== FPS * DURATION || Math.abs(Number(probe.duration) - DURATION) > 0.05) throw new Error(`Invalid GIF dimensions, frames, or duration: ${theme}`);
  const binary = await readFile(gif);
  if (!binary.includes(Buffer.from('NETSCAPE2.0\x03\x01\x00\x00', 'binary'))) throw new Error(`GIF is not configured to loop forever: ${theme}`);
  await writeFile(join(output, `colin-${theme}-still.png`), render(5).toBuffer('image/png'));
}
await writeFile(join(output, 'contributions.json'), JSON.stringify(snapshot, null, 2) + '\n');
await writeFile(join(output, 'manifest.json'), JSON.stringify({ username: snapshot.username, contributions: snapshot.totalContributions,
  particles: layout.particles.length, durationSeconds: DURATION, fps: FPS, scale: layout.scale, sizes, fetchedAt: snapshot.fetchedAt }, null, 2) + '\n');
// Publish only after BOTH themes and metadata succeed. A failed rename rolls back.
const backup = join(cache, `previous-${process.pid}`);
let hadPrevious = false;
try { await rename(destination, backup); hadPrevious = true; }
catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
try { await mkdir(resolve(destination, '..'), { recursive: true }); await rename(output, destination); }
catch (error) { if (hadPrevious) await rename(backup, destination); throw error; }
if (hadPrevious) await rm(backup, { recursive: true });
await rm(staging, { recursive: true });
console.log(`Published both themes to ${destination}: ${JSON.stringify(sizes)}`);
