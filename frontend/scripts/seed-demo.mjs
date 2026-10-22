#!/usr/bin/env node
// Seeds a LOCAL backend with the demo users, secrets and grants from the mockups,
// then writes the users' bearer tokens to frontend/.env.local (gitignored) as
// VITE_DEMO_ACCOUNTS for the login tiles and the "Acting as" switcher.
//
// Usage:  npm run seed:demo [-- --api http://localhost:8000] [-- --suffix _2]
//
// Tokens are only shown once by the backend, so re-running against the same
// database fails with 409. Reset the DB (`docker compose down -v`, then up) or
// pass --suffix to register a fresh set of users.
// Secret values are random dummies; tokens are never printed.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_LOCAL = join(ROOT, '.env.local');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '')]),
  );
}

const fileEnv = { ...readEnvFile(join(ROOT, '.env')), ...readEnvFile(ENV_LOCAL) };
const API = (arg('api') || process.env.VITE_API_URL || fileEnv.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
const SUFFIX = arg('suffix') || '';

// Usernames must match ^[a-zA-Z0-9_-]{3,50}$, so "CD" becomes cd_demo.
const USERS = ['mustapha', 'tekena', 'charity', 'standford', 'cd_demo'];
const u = (name) => name + SUFFIX;

// [name, owner, target version] — mockup 01.
const SECRETS = [
  ['DATABASE_URL', 'mustapha', 4],
  ['DATABASE_PASSWORD', 'tekena', 7],
  ['STRIPE_API_KEY', 'charity', 3],
  ['PAYSTACK_SECRET', 'charity', 2],
  ['SENDGRID_API_KEY', 'standford', 1],
  ['JWT_SIGNING_KEY', 'mustapha', 5],
  ['AWS_ACCESS_KEY_ID', 'tekena', 2],
  ['REDIS_URL', 'cd_demo', 1],
];

// [secret, grantee, permission]. cd_demo has READ on DATABASE_URL (so a rotate
// attempt is a 403) and NO grant on DATABASE_PASSWORD (so opening it is a 403).
const GRANTS = [
  ['DATABASE_URL', 'tekena', 'write'],
  ['DATABASE_URL', 'charity', 'read'],
  ['DATABASE_URL', 'standford', 'read'],
  ['DATABASE_URL', 'cd_demo', 'read'],
  ['DATABASE_PASSWORD', 'mustapha', 'write'],
  ['DATABASE_PASSWORD', 'charity', 'read'],
  ['STRIPE_API_KEY', 'tekena', 'write'],
  ['STRIPE_API_KEY', 'mustapha', 'write'],
  ['STRIPE_API_KEY', 'standford', 'read'],
  ['PAYSTACK_SECRET', 'tekena', 'read'],
  ['SENDGRID_API_KEY', 'mustapha', 'read'],
  ['JWT_SIGNING_KEY', 'tekena', 'read'],
  ['AWS_ACCESS_KEY_ID', 'mustapha', 'read'],
  ['REDIS_URL', 'mustapha', 'write'],
];

const dummy = () => `demo_${randomBytes(18).toString('base64url')}`;

async function call(path, { method = 'GET', body, token } = {}) {
  let res;
  try {
    res = await fetch(API + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`Can't reach ${API}. Is the backend running?`);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data && typeof data.detail === 'string' ? data.detail : `HTTP ${res.status}`;
    const err = new Error(`${method} ${path} failed: ${detail}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function main() {
  console.log(`Seeding demo data into ${API}`);
  await call('/api/health');

  const accounts = {};
  for (const name of USERS) {
    try {
      const { token } = await call('/api/register', { method: 'POST', body: { username: u(name) } });
      const me = await call('/api/me', { token });
      accounts[name] = { id: me.id, username: me.username, token };
      console.log(`  user     ${me.username}`);
    } catch (err) {
      if (err.status === 409) {
        throw new Error(
          `User "${u(name)}" already exists and its token can't be recovered.\n` +
            '  Reset the database (docker compose down -v && docker compose up -d, then restart the API)\n' +
            '  or run again with a suffix, e.g. npm run seed:demo -- --suffix _2',
        );
      }
      throw err;
    }
  }

  const ids = {};
  for (const [name, owner, version] of SECRETS) {
    const token = accounts[owner].token;
    const created = await call('/api/secrets', { method: 'POST', token, body: { name, value: dummy() } });
    ids[name] = created.id;
    for (let v = 1; v < version; v++) {
      await call(`/api/secrets/${created.id}/rotate`, { method: 'PUT', token, body: { value: dummy() } });
    }
    console.log(`  secret   ${name} (v${version}, owner ${accounts[owner].username})`);
  }

  for (const [secret, grantee, permission] of GRANTS) {
    const owner = SECRETS.find((s) => s[0] === secret)[1];
    await call(`/api/secrets/${ids[secret]}/grants`, {
      method: 'POST',
      token: accounts[owner].token,
      body: { username: accounts[grantee].username, permission },
    });
  }
  console.log(`  grants   ${GRANTS.length} created`);

  // Merge into .env.local, replacing any previous VITE_DEMO_ACCOUNTS line.
  const list = USERS.map((n) => accounts[n]);
  const line = `VITE_DEMO_ACCOUNTS=${JSON.stringify(list)}`;
  const existing = existsSync(ENV_LOCAL) ? readFileSync(ENV_LOCAL, 'utf8').split(/\r?\n/) : [];
  const kept = existing.filter((l) => l.trim() && !l.startsWith('VITE_DEMO_ACCOUNTS='));
  if (!kept.some((l) => l.startsWith('VITE_API_URL='))) kept.unshift(`VITE_API_URL=${API}`);
  writeFileSync(
    ENV_LOCAL,
    [
      '# Demo tokens for a LOCAL seeded database only. Never commit or deploy.',
      ...kept.filter((l) => !l.startsWith('# Demo tokens')),
      line,
      '',
    ].join('\n'),
  );
  console.log(`\nWrote ${USERS.length} demo tokens to frontend/.env.local (restart \`npm run dev\` to pick them up).`);
  if (kept.some((l) => /^VITE_USE_MOCK\s*=\s*true\s*$/i.test(l))) {
    console.warn('Warning: .env.local still has VITE_USE_MOCK=true, so the app will keep using the mock API. Set it to false for the real backend.');
  }
}

main().catch((err) => {
  console.error(`\nSeed failed: ${err.message}`);
  process.exit(1);
});
