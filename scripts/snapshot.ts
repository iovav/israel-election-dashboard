import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadElection } from '../server/source';

// Exits non-zero when official data cannot be fetched and validated, so no stale or partial snapshot is published.
const data = await loadElection();
if (data.knesset !== 26 || data.year !== 2026) throw new Error('Refusing to publish results from a different election.');
const out = path.resolve('public', 'results.json');
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(data));
console.log(`Wrote ${out} (fetched ${data.fetchedAt})`);
