import test from 'node:test';
import assert from 'node:assert/strict';
import { countdown, progress, localInput, dayKey } from '../src/lib/time.js';

test('décomposition exacte et arrêt à zéro', () => {
  const now = Date.parse('2026-10-12T00:00:00Z');
  assert.deepEqual(countdown('2026-10-13T02:03:04Z', now), [1, 2, 3, 4]);
  assert.deepEqual(countdown('2026-10-11T00:00:00Z', now), [0, 0, 0, 0]);
  assert.deepEqual(countdown(new Date(now + 500).toISOString(), now), [0, 0, 0, 1]);
});
test('même instant avec différents fuseaux', () => {
  const now = Date.parse('2026-10-12T00:00:00Z');
  assert.deepEqual(
    countdown('2026-10-12T12:00:00+02:00', now),
    countdown('2026-10-12T10:00:00Z', now),
  );
});
test('progression bornée, y compris une échéance antérieure à la création', () => {
  const objective = { created_at: '2026-10-10T00:00:00Z', target_date: '2026-10-14T00:00:00Z' };
  assert.equal(progress(objective, Date.parse('2026-10-12T00:00:00Z')), 50);
  assert.equal(progress(objective, Date.parse('2026-10-01T00:00:00Z')), 0);
  assert.equal(progress(objective, Date.parse('2026-10-20T00:00:00Z')), 100);
  assert.equal(
    progress({ ...objective, target_date: objective.created_at }, Date.parse(objective.created_at)),
    100,
  );
});
test('saisie locale conserve la date et les secondes', () => {
  const date = new Date(2026, 9, 27, 12, 34, 56);
  assert.equal(dayKey(date), '2026-10-27');
  assert.equal(localInput(date), '2026-10-27T12:34:56');
  assert.equal(new Date(localInput(date)).getTime(), date.getTime());
});
