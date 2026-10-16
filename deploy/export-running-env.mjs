// Executed via stdin inside the existing application by prepare-vps.sh.
// Its output contains secrets: redirect it to the protected temporary file only.
const env = process.env;
const values = {
  POSTGRES_PASSWORD: env.PGPASSWORD,
  PIN_PEPPER: env.PIN_PEPPER,
  APP_TAG: 'local',
  POSTGRES_VOLUME: env.DEPLOY_VOLUME,
  PROXY_SUBNET: env.DEPLOY_SUBNET,
  PROXY_GATEWAY: env.DEPLOY_GATEWAY,
};
if (env.PGUSER !== 'chrono' || env.PGDATABASE !== 'chrono' || env.DATABASE_URL) {
  throw new Error('Configuration PostgreSQL inattendue : vérifier la configuration existante.');
}
if (!values.PIN_PEPPER || values.PIN_PEPPER.length < 32) {
  throw new Error('PIN_PEPPER existant absent ou trop court.');
}
for (const value of Object.values(values)) {
  if (!value || /[\r\n\0]/.test(value)) throw new Error('Paramètre existant absent ou invalide.');
}
// Compose dotenv double quotes support JSON escapes; $$ prevents variable interpolation.
const quote = (value) => JSON.stringify(value).replaceAll('$', () => '$$');
process.stdout.write(
  Object.entries(values)
    .map(([key, value]) => `${key}=${quote(value)}`)
    .join('\n') + '\n',
);
