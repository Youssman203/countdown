import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = {
  ...process.env,
  PGUSER: 'chrono',
  PGDATABASE: 'chrono',
  DATABASE_URL: '',
  PGPASSWORD: "test$literal${NO_EXPANSION}'quote\\path # space",
  PIN_PEPPER: 'a-test-pepper-with-more-than-32-characters',
  DEPLOY_VOLUME: 'existing_database_volume',
  DEPLOY_SUBNET: '172.30.25.0/24',
  DEPLOY_GATEWAY: '172.30.25.1',
};
const exportEnv = (overrides = {}) =>
  spawnSync(process.execPath, ['deploy/export-running-env.mjs'], {
    cwd: root,
    env: { ...fixture, ...overrides },
    encoding: 'utf8',
  });

test('environment adoption rejects missing credentials without emitting partial secrets', () => {
  for (const overrides of [
    { PIN_PEPPER: '' },
    { PGPASSWORD: '' },
    { PGPASSWORD: 'bad\nvalue' },
    { DATABASE_URL: 'postgresql://other' },
  ]) {
    const result = exportEnv(overrides);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr.includes(fixture.PGPASSWORD), false);
  }
});

const docker = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8' });
test(
  'Compose preserves adopted secrets and volume, with matching domain, router and network',
  {
    skip: docker.status !== 0 ? 'Docker Compose CLI unavailable (daemon not required)' : false,
  },
  () => {
    const result = exportEnv();
    assert.equal(result.status, 0, result.stderr);
    const directory = mkdtempSync(path.join(tmpdir(), 'chrono-production-'));
    try {
      const file = path.join(directory, '.env.production');
      writeFileSync(file, result.stdout, { mode: 0o600 });
      const env = { ...process.env };
      for (const key of [
        'POSTGRES_PASSWORD',
        'PIN_PEPPER',
        'POSTGRES_VOLUME',
        'PROXY_SUBNET',
        'PROXY_GATEWAY',
        'APP_TAG',
        'COMPOSE_PROJECT_NAME',
      ])
        delete env[key];
      const rendered = spawnSync(
        'docker',
        [
          'compose',
          '-p',
          'chrono',
          '--env-file',
          file,
          '-f',
          'compose.production.yml',
          'config',
          '--format',
          'json',
        ],
        { cwd: root, env, encoding: 'utf8' },
      );
      assert.equal(rendered.status, 0, rendered.stderr);
      const config = JSON.parse(rendered.stdout);
      assert.equal(config.name, 'chrono');
      assert.equal(config.volumes.postgres_data.name, fixture.DEPLOY_VOLUME);
      const app = config.services.app;
      // `compose config` escapes dollars for safe reuse as a Compose document.
      assert.equal(app.environment.PGPASSWORD.replaceAll('$$', '$'), fixture.PGPASSWORD);
      assert.equal(app.environment.PIN_PEPPER, fixture.PIN_PEPPER);
      assert.equal(
        config.services.postgres.environment.POSTGRES_PASSWORD.replaceAll('$$', '$'),
        fixture.PGPASSWORD,
      );
      assert.equal(app.environment.APP_ORIGIN, 'https://spicy-drc.tech');
      assert.equal(app.environment.TRUSTED_PROXY, config.networks.web.ipam.config[0].gateway);
      assert.equal(app.labels['traefik.docker.network'], config.networks.web.name);
      assert.equal(
        app.labels['traefik.http.routers.chrono-spicy-drc.rule'],
        'Host(`spicy-drc.tech`)',
      );
      assert.equal(app.labels['traefik.http.routers.chrono-spicy-drc.service'], 'chrono-spicy-drc');
      assert.equal(
        app.labels['traefik.http.services.chrono-spicy-drc.loadbalancer.server.port'],
        '3001',
      );
      assert.equal(app.ports, undefined);
      assert.equal(config.services.postgres.ports, undefined);
      assert.equal(config.networks.database.internal, true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
