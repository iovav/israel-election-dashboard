import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadElection } from './source';
import type { ElectionData } from '../src/types';

const app = express();
app.disable('x-powered-by');
let cached: ElectionData | undefined;
let inFlight: Promise<ElectionData> | undefined;

app.get('/api/results', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!cached || Date.now() - Date.parse(cached.fetchedAt) >= 60_000) {
      inFlight ??= loadElection();
      try { cached = await inFlight; }
      finally { inFlight = undefined; }
    }
    res.json(cached);
  } catch (error) {
    console.error('Official 2026 election data retrieval failed:', error);
    res.status(502).json({
      error: 'Could not retrieve and validate official 2026 election data.',
      detail: error instanceof Error ? error.message : 'Unexpected data-service failure.',
    });
  }
});
app.get('/api/health', (_req, res) => res.json({ status: 'ok', knesset: 26 }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route.' }));

if (process.env.NODE_ENV !== 'production' && !import.meta.url.includes('dist-server')) {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
} else {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  app.use(express.static(root));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(root, 'index.html')));
}
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');
app.listen(port, '127.0.0.1', () => console.log(`Knesset 26 dashboard ready at http://localhost:${port}`));
