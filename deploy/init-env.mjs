import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const path = new URL('../.env.production', import.meta.url);
const contents = `POSTGRES_PASSWORD=${randomBytes(32).toString('hex')}\nPIN_PEPPER=${randomBytes(48).toString('hex')}\nAPP_TAG=local\nPROXY_SUBNET=172.30.24.0/24\nPROXY_GATEWAY=172.30.24.1\n`;
// Exclusive creation protects existing secrets and therefore existing accounts.
writeFileSync(path, contents, { flag: 'wx', mode: 0o600 });
console.log('.env.production créé. Conservez une copie chiffrée hors du serveur.');
