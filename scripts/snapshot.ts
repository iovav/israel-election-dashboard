import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadElection } from '../server/source';

// Results come from the committed official CSV (data/expc.csv); the committee's CDN is not reachable from GitHub runners.
const csv = await readFile(path.resolve('data', 'expc.csv'));
const data = await loadElection(async () => new Response(csv));
if (data.knesset !== 26 || data.year !== 2026) throw new Error('Refusing to publish results from a different election.');
const out = path.resolve('public', 'results.json');
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(data));
console.log(`Wrote ${out} (fetched ${data.fetchedAt})`);
