import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { objectiveRoutes } from './routes/objectives.js';

export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json({ limit: '16kb' }));
  app.get('/api/health', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'postgresql' });
  });
  app.use('/api/objectives', objectiveRoutes(db));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Route introuvable.' }));
  if (process.env.NODE_ENV === 'production') {
    const dist = fileURLToPath(new URL('../frontend/dist/', import.meta.url));
    app.use(express.static(dist));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed')
      return res.status(400).json({ error: 'Le JSON envoyé est invalide.' });
    if (err.type === 'entity.too.large')
      return res.status(413).json({ error: 'Requête trop volumineuse.' });
    console.error('API:', err.code || err.message);
    res
      .status(503)
      .json({ error: 'La base de données est indisponible. Vérifiez PostgreSQL puis réessayez.' });
  });
  return app;
}
