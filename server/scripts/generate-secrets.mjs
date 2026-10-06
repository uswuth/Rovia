#!/usr/bin/env node
/**
 * Generates local secret files consumed by Docker Compose.
 *
 * Files land in server/secrets/*.txt, which is git-ignored, and are mounted into
 * the API container at /run/secrets/<name>.
 *
 * Usage:
 *   node server/scripts/generate-secrets.mjs           # only fills missing files
 *   node server/scripts/generate-secrets.mjs --force   # regenerates everything
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const secretsDir = path.resolve(__dirname, '../secrets');
const force = process.argv.includes('--force');

// Compose reads the root .env for MONGO_ROOT_USER / MONGO_ROOT_PASSWORD, but a
// bare `node` process does not. Without this the URI is built from `undefined`
// and every container fails Mongo auth. Explicit process env still wins.
const loadDotEnv = () => {
  const envPath = path.join(repoRoot, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, '');
  }
};
loadDotEnv();

fs.mkdirSync(secretsDir, { recursive: true });

const randomSecret = () => crypto.randomBytes(64).toString('hex');

const targets = [
  { file: 'jwt_access_secret.txt', generate: randomSecret },
  { file: 'jwt_refresh_secret.txt', generate: randomSecret },
  {
    file: 'mongo_uri.txt',
    generate: () => {
      const user = process.env.MONGO_ROOT_USER;
      const password = process.env.MONGO_ROOT_PASSWORD;
      // "mongodb" is the service name in the root compose file.
      // Set MONGO_HOST=mongodb-local when using server/docker-compose.yml.
      const host = process.env.MONGO_HOST || 'mongodb';
      return `mongodb://${user}:${password}@${host}:27017/intellmeet?authSource=admin`;
    }
  }
];

let created = 0;
let kept = 0;

for (const { file, generate } of targets) {
  const filePath = path.join(secretsDir, file);

  if (fs.existsSync(filePath) && !force) {
    kept += 1;
    console.log(`kept     ${file}`);
    continue;
  }

  const value = generate();
  fs.writeFileSync(filePath, `${value}\n`, { encoding: 'utf8', mode: 0o600 });
  created += 1;
  console.log(`generated ${file}`);
}

console.log(`\n${created} secret file(s) written, ${kept} left untouched.`);
console.log(`Location: ${secretsDir}`);
console.log('Run "docker compose up --build" from the repository root.\n');
