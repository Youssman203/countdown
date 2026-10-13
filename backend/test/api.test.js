import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';

const id = 'f5141f04-dfde-4c1d-8583-30fb84b9d964';
const valid = {
  title: 'Lancement',
  description: 'Déployer le projet',
  target_date: '2027-10-27T09:00:00+02:00',
  category: 'Professionnel',
  color_theme: 'amber',
};

test('CRUD REST : requêtes paramétrées, réponses et suppression', async () => {
  const calls = [];
  const db = {
    query: async (sql, args) => {
      calls.push({ sql, args });
      return {
        rows: sql.startsWith('DELETE')
          ? [{ id }]
          : [{ ...valid, id, created_at: '2026-10-12T00:00:00Z' }],
        rowCount: 1,
      };
    },
  };
  const app = createApp(db);
  await request(app)
    .get('/api/objectives')
    .expect(200)
    .expect((res) => assert.equal(res.body[0].title, valid.title));
  await request(app).post('/api/objectives').send(valid).expect(201);
  assert.deepEqual(calls[1].args, Object.values(valid));
  assert.match(calls[1].sql, /VALUES \(\$1,\$2,\$3,\$4,\$5\)/);
  await request(app)
    .put(`/api/objectives/${id}`)
    .send({ ...valid, title: "Titre ' SQL" })
    .expect(200);
  assert.equal(calls[2].args[0], "Titre ' SQL");
  assert.equal(calls[2].args[5], id);
  await request(app).delete(`/api/objectives/${id}`).expect(204);
  assert.deepEqual(calls[3].args, [id]);
});

test('validation avant tout accès à la base', async () => {
  const app = createApp({
    query: () => {
      throw new Error('Ne doit pas être appelé');
    },
  });
  for (const body of [
    { ...valid, title: '   ' },
    { ...valid, title: 'a'.repeat(121) },
    { ...valid, target_date: '2027-10-27T09:00:00' },
    { ...valid, target_date: 'invalide' },
    { ...valid, color_theme: 'red' },
    { ...valid, description: 'a'.repeat(2001) },
    { ...valid, id },
  ])
    await request(app).post('/api/objectives').send(body).expect(400);
  await request(app).put('/api/objectives/invalid').send(valid).expect(400);
  await request(app).delete('/api/objectives/invalid').expect(400);
  await request(app)
    .post('/api/objectives')
    .set('Content-Type', 'application/json')
    .send('{bad')
    .expect(400);
});

test('objectif absent : 404 ; base indisponible : 503 sans détails internes', async () => {
  const app = createApp({ query: async () => ({ rows: [], rowCount: 0 }) });
  await request(app).put(`/api/objectives/${id}`).send(valid).expect(404);
  await request(app).delete(`/api/objectives/${id}`).expect(404);
  await request(app).get('/api/unknown').expect(404);
  const unavailable = createApp({
    query: async () => {
      throw new Error('secret database configuration');
    },
  });
  await request(unavailable)
    .get('/api/objectives')
    .expect(503)
    .expect((res) => assert.ok(!res.text.includes('secret')));
});
