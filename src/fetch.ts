import { mkdir, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { normalizeCollection } from './data.ts';

const username = process.env.GITHUB_USERNAME ?? 'colinJina';
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error('GITHUB_TOKEN is required. In Actions use the built-in token; locally use your existing gh login.');
const response = await fetch('https://api.github.com/graphql', {
  method: 'POST', signal: AbortSignal.timeout(30000),
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'colin-contribution-pixels' },
  body: JSON.stringify({ query: `query($login: String!) { user(login: $login) { contributionsCollection { startedAt endedAt contributionCalendar { totalContributions weeks { contributionDays { date contributionCount contributionLevel } } } } } }`, variables: { login: username } }),
});
if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}; previous assets were not changed.`);
const result = await response.json() as { errors?: { message: string }[]; data?: { user?: { contributionsCollection?: unknown } } };
if (result.errors?.length) throw new Error(`GitHub GraphQL: ${result.errors.map(e => e.message).join('; ')}`);
const snapshot = normalizeCollection(result.data?.user?.contributionsCollection, username);
const destination = process.argv[2] ?? '.cache/contributions.json';
await mkdir(dirname(destination), { recursive: true });
await writeFile(`${destination}.tmp`, JSON.stringify(snapshot, null, 2) + '\n');
await rename(`${destination}.tmp`, destination);
console.log(`Fetched ${snapshot.totalContributions} contributions across ${snapshot.days.length} days for ${username}.`);
