import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../app.js';
import { configFromEnv } from '../config.js';

const origin = 'https://spicyi-drc.tech';
const config = {
  production: true,
  origin,
  pepper: 'test-secret-pepper-with-at-least-32-characters',
};
const valid = {
  title: 'Mission privée',
  description: 'Test',
  target_date: '2027-10-27T09:00:00+02:00',
  category: 'Personnel',
  color_theme: 'amber',
};
const sql = await readFile(new URL('../../database/schema.sql', import.meta.url), 'utf8');

test('PostgreSQL : comptes, sessions, isolation et protections HTTP', async (t) => {
  const pg = new PGlite();
  await pg.exec(sql);
  await pg.exec(sql); // Migration must be idempotent.
  const db = {
    query: async (query, values) => {
      const r = await pg.query(query, values);
      return { ...r, rowCount: r.affectedRows };
    },
  };
  const app = createApp(db, config);
  const send = (method, path, body, cookie) => {
    const r = request(app)[method](path).set('Origin', origin);
    if (cookie) r.set('Cookie', cookie);
    return body ? r.send(body) : r;
  };
  const register = (username, pin = '0123') =>
    send('post', '/api/auth/register', { username, name: username, pin });
  const login = (username, pin = '0123') => send('post', '/api/auth/login', { username, pin });
  let alice, bob, objectiveId;
  await t.test('inscription, code avec zéro initial et cookie sécurisé', async () => {
    await register('alice').expect(201);
    await register('bob').expect(201);
    await register('alice').expect(409);
    await register('invalid', '12345').expect(400);
    const response = await login('ALICE').expect(200);
    assert.equal(response.body.user.username, 'alice');
    assert.equal(response.body.user.pin_hash, undefined);
    const cookie = response.headers['set-cookie'][0];
    for (const flag of [
      '__Host-chrono_session=',
      'HttpOnly',
      'Secure',
      'SameSite=Strict',
      'Path=/',
    ])
      assert.ok(cookie.includes(flag));
    alice = cookie.split(';')[0];
    bob = (await login('bob').expect(200)).headers['set-cookie'][0].split(';')[0];
    const stored = (await pg.query('SELECT pin_hash FROM users WHERE username=$1', ['alice']))
      .rows[0].pin_hash;
    assert.notEqual(stored, '0123');
    assert.match(stored, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
  });
  await t.test('accès anonyme, origine absente et CSRF refusés', async () => {
    await request(app).get('/api/objectives').expect(401);
    await request(app).post('/api/auth/login').send({ username: 'alice', pin: '0123' }).expect(403);
    await request(app)
      .post('/api/objectives')
      .set('Origin', 'https://evil.example')
      .set('Cookie', alice)
      .send(valid)
      .expect(403);
    await send('get', '/api/auth/me', null, alice).expect(200).expect('Cache-Control', 'no-store');
  });
  await t.test('CRUD et séparation réelle entre Alice et Bob', async () => {
    const result = await send('post', '/api/objectives', valid, alice).expect(201);
    objectiveId = result.body.id;
    await send('get', '/api/objectives', null, alice)
      .expect(200)
      .expect((r) => assert.equal(r.body.length, 1));
    await send('get', '/api/objectives', null, bob)
      .expect(200)
      .expect((r) => assert.equal(r.body.length, 0));
    await send('put', `/api/objectives/${objectiveId}`, valid, bob).expect(404);
    await send('delete', `/api/objectives/${objectiveId}`, null, bob).expect(404);
    await send(
      'put',
      `/api/objectives/${objectiveId}`,
      { ...valid, title: "Titre ' SQL" },
      alice,
    ).expect(200);
    for (const body of [
      { ...valid, user_id: result.body.user_id },
      { ...valid, title: '   ' },
      { ...valid, target_date: 'invalid' },
      { ...valid, color_theme: 'red' },
    ])
      await send('post', '/api/objectives', body, alice).expect(400);
    await send('delete', '/api/objectives/invalid', null, alice).expect(400);
  });
  await t.test('préférences personnelles et anciens objectifs invisibles', async () => {
    await send('patch', '/api/auth/me', { accent: 'cyan' }, alice).expect(200);
    await send('get', '/api/auth/me', null, bob)
      .expect(200)
      .expect((r) => assert.equal(r.body.user.accent, 'amber'));
    await pg.query("INSERT INTO objectives(title,target_date) VALUES ('Legacy',NOW())");
    await send('get', '/api/objectives', null, alice)
      .expect(200)
      .expect((r) => assert.equal(r.body.length, 1));
  });
  await t.test('limitation par compte persistante, même après redémarrage', async () => {
    for (let i = 0; i < 5; i++) await login('unknown', '1111').expect(401);
    const anotherApp = createApp(db, config);
    await request(anotherApp)
      .post('/api/auth/login')
      .set('Origin', origin)
      .set('X-Forwarded-For', '198.51.100.99')
      .send({ username: 'unknown', pin: '1111' })
      .expect(429)
      .expect('Retry-After', '900');
  });
  await t.test('sessions révoquées, expirées et jetons jamais stockés en clair', async () => {
    const hashes = (await pg.query('SELECT token_hash FROM sessions')).rows;
    assert.ok(hashes.every((row) => row.token_hash !== alice.split('=')[1]));
    await send('delete', `/api/objectives/${objectiveId}`, null, alice).expect(204);
    await send('post', '/api/auth/logout', {}, alice).expect(204);
    await send('get', '/api/objectives', null, alice).expect(401);
    await pg.query("UPDATE sessions SET expires_at=NOW()-INTERVAL '1 second'");
    await send('get', '/api/auth/me', null, bob).expect(401);
  });
  await t.test('JSON invalide et erreurs serveur sans détails internes', async () => {
    await request(app)
      .post('/api/auth/login')
      .set('Origin', origin)
      .set('Content-Type', 'application/json')
      .send('{bad')
      .expect(400);
    const broken = createApp(
      {
        query: async () => {
          throw new Error('secret database configuration');
        },
      },
      config,
    );
    await request(broken)
      .get('/api/health')
      .expect(503)
      .expect((r) => assert.ok(!r.text.includes('secret')));
    await request(app).get('/api/unknown').expect(404);
  });
  await pg.close();
});

test('production refuse une configuration sans secret', () => {
  const previous = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.PIN_PEPPER;
    assert.throws(configFromEnv, /Production/);
  } finally {
    process.env = previous;
  }
});
