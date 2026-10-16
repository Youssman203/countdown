import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { objectiveRoutes } from './routes/objectives.js';
import { authentication } from './auth.js';
import { configFromEnv } from './config.js';

export function createApp(db, config = configFromEnv()) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  // Only loopback and the host's gateway on the dedicated production network are trusted.
  if (config.production)
    app.set('trust proxy', ['loopback', process.env.TRUSTED_PROXY || '172.30.25.1']);
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('Origin');
      const allowed = config.production
        ? [config.origin]
        : [config.origin, 'http://127.0.0.1:5173'];
      if (!allowed.includes(origin))
        return res.status(403).json({ error: 'Origine de la requête non autorisée.' });
    }
    next();
  });
  app.use(express.json({ limit: '16kb' }));
  app.get('/api/health', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'postgresql' });
  });
  const auth = authentication(db, config);
  app.use('/api/auth', auth.router);
  app.use('/api/objectives', auth.requireUser, objectiveRoutes(db));
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
