// Run only from a trusted administrative terminal; generated PIN is shown once.
import { randomInt } from 'node:crypto';
import { pool } from './db.js';
import { hashPin } from './auth.js';
import { configFromEnv } from './config.js';
const username = process.argv[2]?.trim().toLowerCase();
if (!/^[a-z0-9_.-]{3,40}$/.test(username || ''))
  throw new Error('Usage : node backend/reset-pin.js identifiant');
const client = await pool.connect();
try {
  const pin = String(randomInt(10000)).padStart(4, '0');
  const hashed = await hashPin(pin, configFromEnv().pepper);
  await client.query('BEGIN');
  const { rows } = await client.query(
    'UPDATE users SET pin_hash=$1 WHERE username=$2 RETURNING id',
    [hashed, username],
  );
  if (!rows[0]) throw new Error('Compte introuvable.');
  await client.query('DELETE FROM sessions WHERE user_id=$1', [rows[0].id]);
  await client.query('COMMIT');
  console.log(`Nouveau code pour ${username} : ${pin}. Toutes ses sessions sont révoquées.`);
} catch (error) {
  await client.query('ROLLBACK');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
