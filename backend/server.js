import { pool } from './db.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT || 3001);
const server = createApp(pool).listen(port, process.env.HOST || '127.0.0.1', () =>
  console.log(`API CHRONO : http://localhost:${port}`),
);
const cleanup = setInterval(async () => {
  try {
    await pool.query('DELETE FROM sessions WHERE expires_at <= NOW()');
    await pool.query('DELETE FROM auth_limits WHERE reset_at <= NOW()');
  } catch (error) {
    console.error('Session cleanup:', error.code || 'failed');
  }
}, 3600000).unref();
async function shutdown() {
  clearInterval(cleanup);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
