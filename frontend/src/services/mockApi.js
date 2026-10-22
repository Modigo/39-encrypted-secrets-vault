// In-memory mock of api.js (VITE_USE_MOCK=true), seeded with the mockup data.
// Same function names and return shapes as the real client. Values are random
// dummies generated at load time; nothing here is a real credential.
import { ApiError, fallbackMessage } from './errors';

const USERS = [
  { id: 1, username: 'mustapha', name: 'Mustapha A.', initials: 'AA', color: 'violet', role: 'Admin', email: 'mustapha@team.dev' },
  { id: 2, username: 'tekena', name: 'Tekena', initials: 'TK', color: 'teal', role: 'Owner', email: 'tekena@team.dev' },
  { id: 3, username: 'charity', name: 'Charity', initials: 'CH', color: 'orange', role: 'Member', email: 'charity@team.dev' },
  { id: 4, username: 'standford', name: 'Standford', initials: 'ST', color: 'pink', role: 'Member', email: 'standford@team.dev' },
  { id: 5, username: 'cd', name: 'CD', initials: 'CD', color: 'green', role: 'Viewer', email: 'cd@team.dev' },
];

const ACTION_VERB = { read: 'secret.read', write: 'secret.rotate' };

function randomChars(n) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function dummyValue(name) {
  const prefixes = {
    STRIPE_API_KEY: 'sk_live_',
    PAYSTACK_SECRET: 'sk_live_',
    SENDGRID_API_KEY: 'SG.',
    AWS_ACCESS_KEY_ID: 'AKIA',
    DATABASE_URL: 'postgres://app:',
    REDIS_URL: 'redis://default:',
  };
  return (prefixes[name] || '') + randomChars(32);
}

// Time helpers relative to "now" so the seed always renders like the mockups.
const now = Date.now();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
function at(daysAgo, h, m, s = 0) {
  const d = new Date(now - daysAgo * DAY);
  d.setHours(h, m, s, 0);
  return d.getTime();
}
// Day on which the mockup-03 audit times (13:41 – 14:32) have already happened.
const auditDay = new Date(now).getHours() * 60 + new Date(now).getMinutes() > 14 * 60 + 33 ? 0 : 1;

function seed() {
  const secrets = [
    { id: 1, name: 'DATABASE_URL', ownerId: 1, version: 4, updatedAt: now - 2 * MIN, createdAt: at(12, 10, 2), description: 'Primary Postgres connection string for the API' },
    { id: 2, name: 'DATABASE_PASSWORD', ownerId: 2, version: 7, updatedAt: now - HOUR, createdAt: at(30, 9, 40), description: 'Password for the production database user' },
    { id: 3, name: 'STRIPE_API_KEY', ownerId: 3, version: 3, updatedAt: at(0, 9, 12), createdAt: at(4, 11, 5), description: 'Live Stripe secret key for the payments service' },
    { id: 4, name: 'PAYSTACK_SECRET', ownerId: 3, version: 2, updatedAt: now - DAY, createdAt: at(9, 15, 20), description: 'Paystack secret key for NGN payments' },
    { id: 5, name: 'SENDGRID_API_KEY', ownerId: 4, version: 1, updatedAt: now - DAY - 3 * HOUR, createdAt: now - DAY - 3 * HOUR, description: 'API key for transactional emails' },
    { id: 6, name: 'JWT_SIGNING_KEY', ownerId: 1, version: 5, updatedAt: at(3, 17, 30), createdAt: at(40, 12, 0), description: 'HMAC key used to sign session tokens' },
    { id: 7, name: 'AWS_ACCESS_KEY_ID', ownerId: 2, version: 2, updatedAt: at(4, 10, 45), createdAt: at(20, 14, 10), description: 'Deploy user for the S3 asset bucket' },
    { id: 8, name: 'REDIS_URL', ownerId: 5, version: 1, updatedAt: at(5, 16, 0), createdAt: at(5, 16, 0), description: 'Cache and job queue connection' },
  ].map((s) => ({ ...s, value: dummyValue(s.name) }));

  // secretId -> { userId: 'read' | 'write' }. Mirrors scripts/seed-demo.mjs.
  const grants = {
    1: { 2: 'write', 3: 'read', 4: 'read', 5: 'read' },
    2: { 1: 'write', 3: 'read' },
    3: { 2: 'write', 1: 'write', 4: 'read' },
    4: { 2: 'read' },
    5: { 1: 'read' },
    6: { 2: 'read' },
    7: { 1: 'read' },
    8: { 1: 'write' },
  };

  const audit = [
    // STRIPE_API_KEY history (mockup 05)
    { actorId: 3, action: 'secret.create', secretId: 3, outcome: 'success', at: at(4, 11, 5), version: 1 },
    { actorId: 3, action: 'secret.rotate', secretId: 3, outcome: 'success', at: at(2, 16, 40), version: 2 },
    { actorId: 3, action: 'secret.rotate', secretId: 3, outcome: 'success', at: at(0, 9, 12), version: 3 },
    { actorId: 5, action: 'secret.read', secretId: 3, outcome: 'denied', at: at(auditDay, 13, 20, 11) },
    { actorId: 2, action: 'secret.read', secretId: 3, outcome: 'success', at: at(auditDay, 13, 36, 2) },
    // Mockup 03
    { actorId: 5, action: 'secret.rotate', secretId: 6, outcome: 'denied', at: at(auditDay, 13, 41, 39) },
    { actorId: 4, action: 'secret.create', secretId: 5, outcome: 'success', at: at(auditDay, 13, 58, 2), version: 1 },
    { actorId: 1, action: 'permission.update', secretId: 2, outcome: 'success', at: at(auditDay, 14, 5, 44) },
    { actorId: 3, action: 'secret.read', secretId: 3, outcome: 'success', at: at(auditDay, 14, 22, 17) },
    { actorId: 2, action: 'secret.rotate', secretId: 2, outcome: 'success', at: at(auditDay, 14, 30, 51), version: 7 },
    { actorId: 5, action: 'secret.read', secretId: 2, outcome: 'denied', at: at(auditDay, 14, 32, 8) },
  ].map((e, i) => ({ ...e, id: i + 1 }));

  return { secrets, grants, audit, nextSecretId: 9, nextAuditId: audit.length + 1 };
}

export function createMockApi({ getToken }) {
  const db = seed();

  const delay = () => new Promise((r) => setTimeout(r, 120 + Math.random() * 220));
  const userById = (id) => USERS.find((u) => u.id === id);
  const publicUser = (u) => (u ? { ...u } : null);
  const fail = (status, message) => {
    throw new ApiError(status, message || fallbackMessage(status));
  };

  function currentUser(token = getToken()) {
    const user = token && USERS.find((u) => `mock-token-${u.username}` === token);
    if (!user) fail(401, token ? 'Invalid token' : 'Bearer token required');
    return user;
  }

  function accessFor(user, secret) {
    if (user.role === 'Admin' || secret.ownerId === user.id) return 'write';
    return (db.grants[secret.id] || {})[user.id] || 'none';
  }

  function log(actorId, action, secretId, outcome, extra = {}) {
    db.audit.push({ id: db.nextAuditId++, actorId, action, secretId, outcome, at: Date.now(), ...extra });
  }

  function findSecret(id) {
    const secret = db.secrets.find((s) => s.id === Number(id));
    if (!secret) fail(404, 'Secret not found');
    return secret;
  }

  // Like the backend: 404 if missing, 403 (and a denied audit event) if not allowed.
  function requireAccess(user, id, level) {
    const secret = findSecret(id);
    const access = accessFor(user, secret);
    if (access === 'none' || (level === 'write' && access !== 'write')) {
      log(user.id, ACTION_VERB[level], secret.id, 'denied');
      fail(403, 'Permission denied');
    }
    return secret;
  }

  function toSecret(s, user) {
    return {
      id: s.id,
      name: s.name,
      version: s.version,
      owner: publicUser(userById(s.ownerId)),
      isOwner: s.ownerId === user.id,
      updatedAt: new Date(s.updatedAt).toISOString(),
      createdAt: new Date(s.createdAt).toISOString(),
      description: s.description || null,
    };
  }

  return {
    mode: 'mock',
    capabilities: {
      roles: true,
      emails: true,
      descriptions: true,
      createdAt: true,
      listGrants: true,
      deniedActionDetail: true,
    },

    async health() {
      await delay();
      return { status: 'ok' };
    },

    async demoAccounts() {
      return USERS.map((u) => ({ ...publicUser(u), token: `mock-token-${u.username}` }));
    },

    // Mock-only stand-in for the mockup's email/password form: any non-empty
    // password works for a seeded email. The real backend uses tokens instead.
    async tokenForCredentials(email, password) {
      await delay();
      const user = USERS.find((u) => u.email === String(email).trim().toLowerCase());
      if (!user || !password) fail(401, 'Unknown email or password.');
      return `mock-token-${user.username}`;
    },

    async signIn(token) {
      await delay();
      return publicUser(currentUser(token));
    },

    signOut() {},

    async listUsers() {
      await delay();
      currentUser();
      return USERS.map(publicUser);
    },

    async listSecrets() {
      await delay();
      const user = currentUser();
      return db.secrets
        .filter((s) => accessFor(user, s) !== 'none')
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((s) => toSecret(s, user));
    },

    async createSecret({ name, value, description }) {
      await delay();
      const user = currentUser();
      if (!name || !value) fail(422, 'Name and value are required');
      if (db.secrets.some((s) => s.ownerId === user.id && s.name === name)) {
        fail(409, 'You already have a secret with this name');
      }
      const t = Date.now();
      const secret = { id: db.nextSecretId++, name, value, description: description || '', ownerId: user.id, version: 1, createdAt: t, updatedAt: t };
      db.secrets.push(secret);
      log(user.id, 'secret.create', secret.id, 'success', { version: 1 });
      return { id: secret.id, name, version: 1 };
    },

    async knownSecretName(id) {
      const secret = db.secrets.find((s) => s.id === Number(id));
      return secret ? secret.name : null;
    },

    async revealSecret(id) {
      await delay();
      const user = currentUser();
      const secret = requireAccess(user, id, 'read');
      log(user.id, 'secret.read', secret.id, 'success');
      return { id: secret.id, name: secret.name, version: secret.version, value: secret.value };
    },

    async rotateSecret(id, value) {
      await delay();
      const user = currentUser();
      const secret = requireAccess(user, id, 'write');
      if (!value) fail(422, 'Value is required');
      secret.value = value;
      secret.version += 1;
      secret.updatedAt = Date.now();
      log(user.id, 'secret.rotate', secret.id, 'success', { version: secret.version });
      return { id: secret.id, version: secret.version };
    },

    async deleteSecret(id) {
      await delay();
      const user = currentUser();
      const secret = requireAccess(user, id, 'read');
      if (secret.ownerId !== user.id && user.role !== 'Admin') {
        log(user.id, 'secret.delete', secret.id, 'denied');
        fail(403, 'Only owner can delete');
      }
      db.secrets = db.secrets.filter((s) => s.id !== secret.id);
      delete db.grants[secret.id];
      log(user.id, 'secret.delete', secret.id, 'success', { name: secret.name });
    },

    async listGrants(id) {
      await delay();
      const user = currentUser();
      const secret = requireAccess(user, id, 'read');
      const grants = db.grants[secret.id] || {};
      const members = USERS.map((u) => ({
        user: publicUser(u),
        access: u.id === secret.ownerId || u.role === 'Admin' ? 'write' : grants[u.id] || 'none',
        isOwner: u.id === secret.ownerId,
      }));
      return { members, complete: true };
    },

    async setAccess(id, username, access) {
      await delay();
      const user = currentUser();
      const secret = requireAccess(user, id, 'read');
      if (secret.ownerId !== user.id && user.role !== 'Admin') {
        log(user.id, 'permission.update', secret.id, 'denied');
        fail(403, 'Only owner can grant access');
      }
      const target = USERS.find((u) => u.username === username);
      if (!target) fail(404, 'User not found');
      if (target.id === secret.ownerId) fail(400, 'Owner already has full access');
      const grants = (db.grants[secret.id] ||= {});
      if (access === 'none') delete grants[target.id];
      else grants[target.id] = access;
      log(user.id, access === 'none' ? 'permission.revoke' : 'permission.update', secret.id, 'success');
    },

    async listAudit() {
      await delay();
      const user = currentUser();
      const owned = new Set(db.secrets.filter((s) => s.ownerId === user.id).map((s) => s.id));
      return db.audit
        .filter((e) => user.role === 'Admin' || e.actorId === user.id || owned.has(e.secretId))
        .sort((a, b) => b.at - a.at)
        .slice(0, 100)
        .map((e) => {
          const secret = db.secrets.find((s) => s.id === e.secretId);
          return {
            id: e.id,
            at: new Date(e.at).toISOString(),
            actor: publicUser(userById(e.actorId)),
            action: e.action,
            secretId: e.secretId,
            secretName: secret ? secret.name : e.name || null,
            outcome: e.outcome,
            version: e.version ?? null,
          };
        });
    },
  };
}
