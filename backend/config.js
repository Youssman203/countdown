export function configFromEnv() {
  const production = process.env.NODE_ENV === 'production';
  const origin = process.env.APP_ORIGIN || 'http://localhost:5173';
  const pepper =
    process.env.PIN_PEPPER || (production ? '' : 'development-only-pepper-never-use-in-production');
  if (production && (!/^https:\/\//.test(origin) || pepper.length < 32)) {
    throw new Error('Production : APP_ORIGIN HTTPS et PIN_PEPPER (32 caractères minimum) requis.');
  }
  if (new URL(origin).origin !== origin)
    throw new Error('APP_ORIGIN doit être une origine sans chemin.');
  return { production, origin, pepper };
}
