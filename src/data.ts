export const LEVELS = ['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'] as const;
export type Level = typeof LEVELS[number];
export interface Day { date: string; contributionCount: number; contributionLevel: Level }
export interface Snapshot {
  username: string; startedAt: string; endedAt: string; fetchedAt: string;
  totalContributions: number; days: Day[];
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object');
  return value as Record<string, unknown>;
}
function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('Invalid timestamp');
  return value;
}
export function validateSnapshot(value: unknown): Snapshot {
  const s = record(value);
  if (typeof s.username !== 'string' || !/^[a-z\d-]+$/i.test(s.username)) throw new Error('Invalid username');
  const startedAt = timestamp(s.startedAt), endedAt = timestamp(s.endedAt), fetchedAt = timestamp(s.fetchedAt);
  if (Date.parse(startedAt) >= Date.parse(endedAt)) throw new Error('Invalid date range');
  if (!Array.isArray(s.days) || s.days.length < 1 || s.days.length > 371) throw new Error('Invalid calendar length');
  const seen = new Set<string>();
  const days: Day[] = s.days.map(value => {
    const d = record(value);
    if (typeof d.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.date) || !Number.isFinite(Date.parse(d.date)) || new Date(d.date).toISOString().slice(0, 10) !== d.date || seen.has(d.date)) throw new Error('Invalid or duplicate date');
    if (!Number.isSafeInteger(d.contributionCount) || (d.contributionCount as number) < 0) throw new Error('Invalid daily count');
    if (!LEVELS.includes(d.contributionLevel as Level)) throw new Error('Invalid contribution level');
    if ((d.contributionCount === 0) !== (d.contributionLevel === 'NONE')) throw new Error('Count and level disagree');
    seen.add(d.date);
    return d as unknown as Day;
  }).sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < days.length; i++) {
    if (Date.parse(days[i].date) - Date.parse(days[i - 1].date) !== 86400000) throw new Error('Missing calendar day');
  }
  // GitHub may pad the calendar to week boundaries. Check coverage, not UTC date equality.
  if (Math.abs(Date.parse(days[0].date) - Date.parse(startedAt)) > 7 * 86400000 || Math.abs(Date.parse(days.at(-1)!.date) - Date.parse(endedAt)) > 2 * 86400000) throw new Error('Calendar outside requested range');
  const total = days.reduce((sum, day) => sum + day.contributionCount, 0);
  if (!Number.isSafeInteger(s.totalContributions) || total !== s.totalContributions) throw new Error('Daily counts do not match totalContributions');
  return { username: s.username, startedAt, endedAt, fetchedAt, totalContributions: total, days };
}
export function normalizeCollection(value: unknown, username: string, fetchedAt = new Date().toISOString()): Snapshot {
  const collection = record(value), calendar = record(collection.contributionCalendar);
  if (!Array.isArray(calendar.weeks)) throw new Error('Missing calendar weeks');
  return validateSnapshot({ username, startedAt: collection.startedAt, endedAt: collection.endedAt, fetchedAt,
    totalContributions: calendar.totalContributions,
    days: calendar.weeks.flatMap(week => {
      const w = record(week);
      if (!Array.isArray(w.contributionDays)) throw new Error('Missing contributionDays');
      return w.contributionDays;
    }) });
}
