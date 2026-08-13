import express from 'express';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rankingsMiddleware } from './server/rankings.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const app = express();
const port = Number(process.env.PORT || 4173);

app.get('/api/rankings', rankingsMiddleware);
app.use(express.static(resolve(root, 'dist')));
app.use((_req, res) => res.sendFile(resolve(root, 'dist/index.html')));

app.listen(port, () => console.log(`PlayPulse running at http://localhost:${port}`));
