import { readFile } from 'node:fs/promises';
import { pool } from './db.js';
try {
  await pool.query(await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8'));
  console.log('Schéma PostgreSQL prêt.');
} finally {
  await pool.end();
}
