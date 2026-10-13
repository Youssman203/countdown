import { pool } from './db.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT || 3001);
const server = createApp(pool).listen(port, process.env.HOST || '127.0.0.1', () =>
  console.log(`API CHRONO : http://localhost:${port}`),
);
async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
