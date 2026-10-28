import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadElection } from '../server/source';
import type { ElectionData } from '../src/types';

// The CDN can briefly serve an empty or error response while the committee updates the file, so retry before failing.
const attempts = 5;
let data: ElectionData | undefined;
for (let attempt = 1; !data; attempt++) {
  try {
    data = await loadElection();
  } catch (error) {
    console.error(`Attempt ${attempt}/${attempts} failed:`, error instanceof Error ? error.message : error);
    if (attempt >= attempts) throw error;
    await new Promise(resolve => setTimeout(resolve, 20_000));
  }
}
// Exits non-zero when official data cannot be fetched and validated, so no stale or partial snapshot is published.
if (data.knesset !== 26 || data.year !== 2026) throw new Error('Refusing to publish results from a different election.');
const out = path.resolve('public', 'results.json');
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(data));
console.log(`Wrote ${out} (fetched ${data.fetchedAt})`);
