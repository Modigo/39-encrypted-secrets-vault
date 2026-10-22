// Single API client for the app. Talks to the FastAPI backend (backend/main.py)
// and converts its responses into the shapes the UI uses, or swaps in the
// in-memory mock when VITE_USE_MOCK=true. See BACKEND_REQUESTS.md for gaps.
import { ApiError, fallbackMessage } from './errors';
import { profileFromUsername, unknownUser } from './profiles';
import { demoAccounts } from './demoAccounts';
import { createMockApi } from './mockApi';

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

const ACTIONS = {
  create: 'secret.create',
  read: 'secret.read',
  rotate: 'secret.rotate',
  delete: 'secret.delete',
  grant: 'permission.update',
  revoke: 'permission.revoke',
  // The backend logs every denial as "access" without saying what was attempted.
  access: 'secret.access',
};

function errorMessage(status, body) {
  const detail = body && body.detail;
  if (typeof detail === 'string' && detail) return detail;
  if (Array.isArray(detail)) {
    // Pydantic errors: only use `msg`; never echo `input`, which may hold the secret value.
    const msgs = detail.map((d) => d && d.msg).filter(Boolean);
    if (msgs.length) return msgs.join('; ');
  }
  return fallbackMessage(status);
}

function createRealApi({ getToken }) {
  // In-memory lookups so names can be shown where the backend only returns ids.
  // Cleared on page reload; never persisted.
  const usersById = new Map(demoAccounts.map((a) => [a.id, a.username]));
  const secretNames = new Map();
  const secretOwners = new Map();
  // No list-grants endpoint yet: remember grants made in this session only.
  const sessionGrants = new Map(); // secretId -> Map(username -> 'read' | 'write')

  async function request(path, { method = 'GET', body, token = getToken() } = {}) {
    let res;
    try {
      res = await fetch(BASE_URL + path, {
        method,
        cache: 'no-store',
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(0, fallbackMessage(0));
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) throw new ApiError(res.status, errorMessage(res.status, data));
    return data;
  }

  function ownerOf(ownerId) {
    const username = usersById.get(ownerId);
    return username ? profileFromUsername(ownerId, username) : unknownUser(ownerId);
  }

  function toSecret(row, meId) {
    secretNames.set(row.id, row.name);
    secretOwners.set(row.id, row.owner_id);
    return {
      id: row.id,
      name: row.name,
      version: row.version,
      owner: ownerOf(row.owner_id),
      isOwner: row.owner_id === meId,
      updatedAt: row.updated_at,
      createdAt: null,
      description: null,
    };
  }

  let me = null;

  return {
    mode: 'real',
    capabilities: {
      roles: false,
      emails: false,
      descriptions: false,
      createdAt: false,
      listGrants: false,
      deniedActionDetail: false,
    },

    async health() {
      return request('/api/health', { token: null });
    },

    async signIn(token) {
      const row = await request('/api/me', { token });
      usersById.set(row.id, row.username);
      me = profileFromUsername(row.id, row.username);
      return me;
    },

    signOut() {
      me = null;
    },

    async demoAccounts() {
      return demoAccounts.map((a) => ({ ...profileFromUsername(a.id, a.username), token: a.token }));
    },

    async listUsers() {
      return [...usersById.entries()].map(([id, username]) => profileFromUsername(id, username));
    },

    async listSecrets() {
      const rows = await request('/api/secrets');
      return rows.map((r) => toSecret(r, me && me.id));
    },

    async createSecret({ name, value }) {
      const row = await request('/api/secrets', { method: 'POST', body: { name, value } });
      secretNames.set(row.id, row.name);
      if (me) secretOwners.set(row.id, me.id);
      return { id: row.id, name: row.name, version: row.version };
    },

    // Name seen earlier in this browser session (any user), or null.
    async knownSecretName(id) {
      return secretNames.get(Number(id)) || null;
    },

    async revealSecret(id) {
      const row = await request(`/api/secrets/${encodeURIComponent(id)}`);
      secretNames.set(row.id, row.name);
      return { id: row.id, name: row.name, version: row.version, value: row.value };
    },

    async rotateSecret(id, value) {
      const row = await request(`/api/secrets/${encodeURIComponent(id)}/rotate`, {
        method: 'PUT',
        body: { value },
      });
      return { id: row.id, version: row.version };
    },

    async deleteSecret(id) {
      await request(`/api/secrets/${encodeURIComponent(id)}`, { method: 'DELETE' });
      sessionGrants.delete(Number(id));
    },

    // Returns { members, complete }. `complete: false` means only the owner plus
    // grants made in this browser session are known.
    async listGrants(id) {
      const sid = Number(id);
      const members = [];
      const ownerId = secretOwners.get(sid);
      if (ownerId != null) members.push({ user: ownerOf(ownerId), access: 'write', isOwner: true });
      for (const [username, access] of sessionGrants.get(sid) || []) {
        const entry = [...usersById.entries()].find(([, u]) => u === username);
        members.push({
          user: profileFromUsername(entry ? entry[0] : null, username),
          access,
          isOwner: false,
        });
      }
      return { members, complete: false };
    },

    // access: 'none' | 'read' | 'write'
    async setAccess(id, username, access) {
      const sid = Number(id);
      if (access === 'none') {
        await request(`/api/secrets/${sid}/grants/${encodeURIComponent(username)}`, { method: 'DELETE' });
      } else {
        await request(`/api/secrets/${sid}/grants`, { method: 'POST', body: { username, permission: access } });
      }
      const grants = sessionGrants.get(sid) || new Map();
      grants.set(username, access);
      sessionGrants.set(sid, grants);
    },

    async listAudit() {
      const rows = await request('/api/audit');
      return rows.map((r) => {
        // A create event tells us who owns that secret, so learn the owner's username.
        if (r.action === 'create' && r.actor && secretOwners.has(r.secret_id)) {
          usersById.set(secretOwners.get(r.secret_id), r.actor);
        }
        return {
          id: r.id,
          at: r.at,
          actor: r.actor ? profileFromUsername(null, r.actor) : unknownUser('?'),
          action: ACTIONS[r.action] || r.action,
          secretId: r.secret_id,
          secretName: secretNames.get(r.secret_id) || null,
          outcome: r.outcome === 'denied' ? 'denied' : 'success',
          version: null,
        };
      });
    },
  };
}

// ---- Session + facade -------------------------------------------------------
// The bearer token lives only in this module's memory (never in storage).
let authToken = null;
let unauthorizedHandler = null;

export function setAuthToken(token) {
  authToken = token || null;
}

export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

const impl = USE_MOCK
  ? createMockApi({ getToken: () => authToken })
  : createRealApi({ getToken: () => authToken });

// Calls that must not trigger the global "401 -> sign out" (they handle it themselves).
const NO_GLOBAL_401 = new Set(['signIn', 'health', 'tokenForCredentials']);

export const api = Object.fromEntries(
  Object.entries(impl).map(([key, value]) => {
    if (typeof value !== 'function') return [key, value];
    const wrapped = async (...args) => {
      try {
        return await value(...args);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401 && !NO_GLOBAL_401.has(key) && unauthorizedHandler) {
          unauthorizedHandler();
        }
        throw err instanceof ApiError ? err : new ApiError(-1, 'Something went wrong. Please try again.');
      }
    };
    return [key, wrapped];
  }),
);
