import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

dotenv.config({ path: fileURLToPath(new URL('.env', import.meta.url)), quiet: true });
export const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgresql://chrono:chrono_local_only@localhost:5432/chrono',
  max: 10,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 30000,
});
pool.on('error', (error) => console.error('PostgreSQL pool:', error.message));
