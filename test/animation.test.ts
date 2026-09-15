import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSnapshot, normalizeCollection } from '../src/data.ts';
import type { Snapshot } from '../src/data.ts';
import { makeLayout, cells, CELL } from '../src/layout.ts';
import { position } from '../src/timeline.ts';
function sample(total: number): Snapshot {
  return { username: 'colinJina', startedAt: '2026-09-14T00:00:00Z', endedAt: '2026-09-15T23:59:59Z', fetchedAt: '2026-09-15T12:00:00Z', totalContributions: total,
    days: [{ date: '2026-09-14', contributionCount: 0, contributionLevel: 'NONE' }, { date: '2026-09-15', contributionCount: total, contributionLevel: total ? 'FOURTH_QUARTILE' : 'NONE' }] };
}
for (const n of [0, 1, 5, 55, 71, 72, 1000, 10000, 30000]) {
  test(`${n} contributions preserve provenance, cardinality, glyph bounds and timing`, () => {
    const s = validateSnapshot(sample(n)); const layout = makeLayout(s);
    assert.equal(layout.particles.length, n);
    const occupied = new Set<string>();
    for (const p of layout.particles) {
      const cell = cells[p.cell];
      assert.ok(p.x >= cell.x && p.x + p.size <= cell.x + CELL);
      assert.ok(p.y >= cell.y && p.y + p.size <= cell.y + CELL);
      assert.equal(p.level, 'FOURTH_QUARTILE'); assert.equal(p.date, '2026-09-15');
      const key = `${p.x},${p.y}`; assert.ok(!occupied.has(key)); occupied.add(key);
      assert.equal(position(p, 0).y, p.startY);
      assert.deepEqual(position(p, 4), { x: p.x, y: p.y });
      assert.deepEqual(position(p, 8), { x: p.x, y: p.y });
      assert.ok(position(p, 9.9667).y > 360);
    }
    if (n >= cells.length) assert.equal(new Set(layout.particles.map(p => p.cell)).size, cells.length);
    if (n >= 5) assert.equal(new Set(layout.particles.map(p => cells[p.cell].glyph)).size, 5);
  });
}
test('same input is deterministic, including when only fetch time changes', () => {
  assert.deepEqual(makeLayout(sample(71)), makeLayout({ ...sample(71), fetchedAt: '2026-09-16T00:00:00Z' }));
});
test('moving particles never cross the vertical order of another same-column particle', () => {
  const { particles } = makeLayout(sample(1000));
  const columns = new Map<number, typeof particles>();
  for (const p of particles) { const column = columns.get(p.x) ?? []; column.push(p); columns.set(p.x, column); }
  for (const column of columns.values()) {
    column.sort((a, b) => a.y - b.y);
    for (let frame = 0; frame < 300; frame++) for (let i = 1; i < column.length; i++) {
      const upper = position(column[i - 1], frame / 30), lower = position(column[i], frame / 30);
      if (upper.y >= 65 && lower.y <= 283) assert.ok(upper.y <= lower.y);
    }
  }
});
test('rejects mismatched counts, duplicate/missing days, malformed levels and null API results', () => {
  assert.throws(() => validateSnapshot({ ...sample(71), totalContributions: 72 }), /match/);
  assert.throws(() => validateSnapshot({ ...sample(71), days: [sample(71).days[1], sample(71).days[1]] }), /duplicate/);
  assert.throws(() => validateSnapshot({ ...sample(71), days: [{ ...sample(71).days[0], date: '2026-09-12' }, sample(71).days[1]] }), /Missing/);
  assert.throws(() => validateSnapshot({ ...sample(71), days: [{ ...sample(71).days[1], contributionLevel: 'NONE' }] }), /disagree/);
  assert.throws(() => normalizeCollection(null, 'colinJina'));
});
