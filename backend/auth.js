import { Router } from 'express';
import {
  randomBytes,
  createHash,
  createHmac,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';

const scrypt = promisify(scryptCallback);
const credentials = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9_.-]{3,40}$/),
    pin: z.string().regex(/^\d{4}$/),
  })
  .strict();
const registration = credentials.extend({ name: z.string().trim().min(1).max(60) });
const hashToken = (value) => createHash('sha256').update(value).digest('hex');
const publicUser = (row) => ({
  id: row.id,
  username: row.username,
  name: row.name,
  accent: row.accent,
});

export async function hashPin(pin, pepper, salt = randomBytes(16).toString('hex')) {
  const input = createHmac('sha256', pepper).update(pin).digest('hex');
  const hash = await scrypt(input, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `${salt}:${hash.toString('hex')}`;
}
export async function verifyPin(pin, stored, pepper) {
  const [salt, expected] = stored.split(':');
  const actual = (await hashPin(pin, pepper, salt)).split(':')[1];
  const a = Buffer.from(actual, 'hex'),
    b = Buffer.from(expected, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function authentication(db, config) {
  const cookieName = config.production ? '__Host-chrono_session' : 'chrono_session';
  const cookieOptions = {
    httpOnly: true,
    secure: config.production,
    sameSite: 'strict',
    path: '/',
  };
  const readToken = (req) => {
    const value = (req.headers.cookie || '')
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    return /^[a-f0-9]{64}$/.test(value || '') ? value : null;
  };
  async function requireUser(req, res, next) {
    const token = readToken(req);
    if (!token)
      return res.status(401).json({ error: 'Connectez-vous pour accéder à votre espace.' });
    const { rows } = await db.query(
      'SELECT u.id, u.username, u.name, u.accent FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at > NOW()',
      [hashToken(token)],
    );
    if (!rows[0]) {
      res.clearCookie(cookieName, cookieOptions);
      return res.status(401).json({ error: 'Votre session a expiré. Reconnectez-vous.' });
    }
    req.user = publicUser(rows[0]);
    next();
  }
  // Atomic, shared across instances and restarts. Account keys resist distributed guessing.
  async function consume(key, limit, seconds) {
    const { rows } = await db.query(
      `INSERT INTO auth_limits (key, attempts, reset_at)
      VALUES ($1,1,NOW()+$2 * INTERVAL '1 second')
      ON CONFLICT (key) DO UPDATE SET
        attempts=CASE WHEN auth_limits.reset_at <= NOW() THEN 1 ELSE auth_limits.attempts+1 END,
        reset_at=CASE WHEN auth_limits.reset_at <= NOW() THEN EXCLUDED.reset_at ELSE auth_limits.reset_at END
      RETURNING attempts, reset_at`,
      [hashToken(key), seconds],
    );
    return Number(rows[0].attempts) <= limit;
  }
  function throttle(kind) {
    return async (req, res, next) => {
      const username =
        typeof req.body?.username === 'string'
          ? req.body.username.trim().toLowerCase().slice(0, 40)
          : '';
      const limits = [[`${kind}:ip:${req.ip}`, kind === 'register' ? 10 : 30, 3600]];
      if (kind === 'login')
        limits.push([`login:account:${username}`, 5, 900], [`login:daily:${username}`, 20, 86400]);
      for (const [key, count, seconds] of limits) {
        if (!(await consume(key, count, seconds))) {
          res.set('Retry-After', String(seconds));
          return res.status(429).json({ error: 'Trop de tentatives. Réessayez plus tard.' });
        }
      }
      next();
    };
  }
  async function issueSession(req, res, user) {
    const previous = readToken(req);
    if (previous) await db.query('DELETE FROM sessions WHERE token_hash=$1', [hashToken(previous)]);
    const token = randomBytes(32).toString('hex');
    await db.query(
      "INSERT INTO sessions (token_hash,user_id,expires_at) VALUES ($1,$2,NOW()+INTERVAL '7 days')",
      [hashToken(token), user.id],
    );
    res.cookie(cookieName, token, { ...cookieOptions, maxAge: 7 * 86400000 });
  }
  const router = Router();
  router.post('/register', throttle('register'), async (req, res) => {
    const parsed = registration.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        error: 'Saisissez un nom, un identifiant de 3 à 40 caractères et exactement 4 chiffres.',
      });
    const { username, name, pin } = parsed.data;
    const pinHash = await hashPin(pin, config.pepper);
    const { rows } = await db.query(
      'INSERT INTO users (username,name,pin_hash) VALUES ($1,$2,$3) ON CONFLICT (username) DO NOTHING RETURNING id,username,name,accent',
      [username, name, pinHash],
    );
    if (!rows[0]) return res.status(409).json({ error: 'Cet identifiant est indisponible.' });
    // Registration does not authenticate: it cannot be used to guess a pre-existing account's PIN.
    res.status(201).json({ message: 'Compte créé. Vous pouvez vous connecter.' });
  });
  router.post('/login', throttle('login'), async (req, res) => {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Identifiant ou code invalide.' });
    const { username, pin } = parsed.data;
    const { rows } = await db.query('SELECT * FROM users WHERE username=$1', [username]);
    const user = rows[0];
    const dummy = `${'0'.repeat(32)}:${'0'.repeat(128)}`;
    const valid = await verifyPin(pin, user?.pin_hash || dummy, config.pepper);
    if (!user || !valid) return res.status(401).json({ error: 'Identifiant ou code incorrect.' });
    await issueSession(req, res, user);
    res.json({ user: publicUser(user) });
  });
  router.get('/me', requireUser, (req, res) => res.json({ user: req.user }));
  router.patch('/me', requireUser, async (req, res) => {
    const parsed = z
      .object({ accent: z.enum(['amber', 'cyan', 'emerald']) })
      .strict()
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Thème invalide.' });
    const { rows } = await db.query(
      'UPDATE users SET accent=$1 WHERE id=$2 RETURNING id,username,name,accent',
      [parsed.data.accent, req.user.id],
    );
    res.json({ user: publicUser(rows[0]) });
  });
  router.post('/logout', async (req, res) => {
    const token = readToken(req);
    if (token) await db.query('DELETE FROM sessions WHERE token_hash=$1', [hashToken(token)]);
    res.clearCookie(cookieName, cookieOptions);
    res.status(204).end();
  });
  return { router, requireUser };
}
