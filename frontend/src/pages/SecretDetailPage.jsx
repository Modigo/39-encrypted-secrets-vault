import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Clock, Copy, Eye, EyeOff, FileQuestion, RotateCw, Trash2 } from 'lucide-react';
import { useBreadcrumb } from '../components/Layout';
import { AccessDenied } from '../components/AccessDenied';
import { AUDIT_POLL_MS } from '../components/AuditLogCard';
import { Avatar, UserChip } from '../components/Avatar';
import { ACCESS_LABELS, Badge, OutcomeBadge, VersionBadge } from '../components/Badge';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { DeleteSecretModal, RotateSecretModal } from '../components/SecretModals';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { useSecrets } from '../context/SecretsContext';
import { usePolling } from '../hooks/usePolling';
import { api } from '../services/api';
import { dateTime, maskFor, relativeTime, shortDateTime } from '../utils/format';

export const REVEAL_MS = 30_000;

// Remount per id so reveal state, denial and probes never carry across secrets.
export function SecretDetailPage() {
  const { id } = useParams();
  return <SecretDetail key={id} id={id} />;
}

function SecretDetail({ id }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: secrets, error: listError, refresh: refreshList } = useSecrets();
  const secret = secrets?.find((s) => String(s.id) === id);
  const [denied, setDenied] = useState(location.state?.denied || null);
  const [missing, setMissing] = useState(!/^\d+$/.test(id));
  const [probeError, setProbeError] = useState(null);
  const [rotating, setRotating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [knownName, setKnownName] = useState(location.state?.denied?.secretName || null);

  const name = secret?.name || denied?.secretName || knownName || `#${id}`;
  useBreadcrumb([{ label: 'Vault', to: '/secrets' }, { label: 'Secrets', to: '/secrets' }, { label: name }]);

  const listReady = secrets !== undefined;
  const found = Boolean(secret);

  // Not in the list: either it doesn't exist or we can't see it. The backend has
  // no metadata endpoint, so re-check the list, then try GET /api/secrets/{id}
  // once to learn 403 vs 404. A successful response's value is discarded unused.
  useEffect(() => {
    if (!listReady || found || denied || missing) return undefined;
    let active = true;
    (async () => {
      try {
        const fresh = await api.listSecrets();
        if (!active) return;
        if (fresh.some((s) => String(s.id) === id)) {
          refreshList();
          return;
        }
        setKnownName(await api.knownSecretName(id));
        await api.revealSecret(id);
        if (active) refreshList();
      } catch (err) {
        if (!active) return;
        if (err.status === 403) {
          const secretName = await api.knownSecretName(id);
          if (active) setDenied({ action: 'read', at: Date.now(), secretId: id, secretName });
        } else if (err.status === 404) {
          setMissing(true);
        } else if (err.status !== 401) {
          setProbeError(err);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [listReady, found, denied, missing, id, refreshList]);

  function deny(action) {
    setDenied({ action, at: Date.now(), secretId: id, secretName: secret?.name || knownName });
  }

  if (denied) return <AccessDenied denied={denied} />;

  if (missing) {
    return (
      <div className="card">
        <EmptyState icon={FileQuestion} title="Secret not found" action={<Button onClick={() => navigate('/secrets')}>Back to secrets</Button>}>
          It may have been deleted, or the link is wrong.
        </EmptyState>
      </div>
    );
  }

  if (!secret) {
    const err = probeError || (!secrets && listError);
    if (err) {
      return (
        <div className="card">
          <EmptyState
            icon={FileQuestion}
            tone="danger"
            title="Couldn't load this secret"
            action={
              <Button
                onClick={() => {
                  setProbeError(null);
                  refreshList();
                }}
              >
                Try again
              </Button>
            }
          >
            {err.message}
          </EmptyState>
        </div>
      );
    }
    return <DetailSkeleton />;
  }

  return (
    <>
      <div className="page-header">
        <div className="detail-heading">
          <div className="detail-title-row">
            <h1 className="page-title mono">{secret.name}</h1>
            <BumpingVersion version={secret.version} />
          </div>
          {secret.description && <p className="page-sub detail-desc">{secret.description}</p>}
        </div>
        <div className="page-actions">
          <Button icon={RotateCw} onClick={() => setRotating(true)}>Rotate</Button>
          <Button variant="danger" icon={Trash2} onClick={() => setDeleting(true)}>Delete</Button>
        </div>
      </div>

      {listError && (
        <ErrorBanner title="Couldn't refresh this secret." onRetry={refreshList}>
          Showing the last known details. Retrying automatically.
        </ErrorBanner>
      )}

      <div className="detail-grid">
        <div className="detail-col">
          {/* key: a rotation invalidates any revealed (now old) value */}
          <ValueCard key={secret.version} secret={secret} onDenied={() => deny('read')} />
          <DetailsCard secret={secret} />
        </div>
        <div className="detail-col">
          <SecretActivity secret={secret} />
        </div>
      </div>

      {rotating && (
        <RotateSecretModal secret={secret} onClose={() => setRotating(false)} onRotated={refreshList} onDenied={() => deny('rotate')} />
      )}
      {deleting && (
        <DeleteSecretModal
          secret={secret}
          onClose={() => setDeleting(false)}
          onDeleted={() => {
            refreshList();
            navigate('/secrets', { replace: true });
          }}
          onDenied={() => deny('delete')}
        />
      )}
    </>
  );
}

// Version badge that pulses when the version changes (after a rotation).
function BumpingVersion({ version }) {
  const prev = useRef(version);
  const [bump, setBump] = useState(false);
  useEffect(() => {
    if (prev.current !== version) {
      prev.current = version;
      setBump(true);
      const t = setTimeout(() => setBump(false), 1600);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [version]);
  return (
    <span className={bump ? 'version-bump' : undefined}>
      <VersionBadge version={version} />
    </span>
  );
}

// ---- Value -----------------------------------------------------------------
// The decrypted value exists only in this component's state. It's cleared on
// Hide, after REVEAL_MS, on rotation (remount via key) and on unmount.
function ValueCard({ secret, onDenied }) {
  const toast = useToast();
  const [value, setValue] = useState(null);
  const [revealedAt, setRevealedAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  const hide = () => {
    setValue(null);
    setRevealedAt(null);
  };

  useEffect(() => {
    if (!revealedAt) return undefined;
    const t = setInterval(() => {
      const current = Date.now();
      if (current - revealedAt >= REVEAL_MS) hide();
      else setNow(current);
    }, 200);
    return () => clearInterval(t);
  }, [revealedAt]);

  useEffect(() => hide, []);

  async function reveal() {
    setBusy(true);
    try {
      const result = await api.revealSecret(secret.id);
      const t = Date.now();
      setValue(result.value);
      setRevealedAt(t);
      setNow(t);
    } catch (err) {
      if (err.status === 403) onDenied();
      else if (err.status !== 401) toast.error(`Couldn't reveal ${secret.name}: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (await copyText(value)) toast.success('Value copied to clipboard');
    else toast.error("Couldn't copy. Select the value and copy it manually.");
  }

  const revealed = value !== null;
  const remaining = revealed ? Math.max(0, REVEAL_MS - (now - revealedAt)) : 0;

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">Value</h2>
          <p className="card-sub">Revealing a value is recorded in the audit log.</p>
        </div>
        {revealed && (
          <Badge tone="warning" icon={Clock}>
            Hides in {Math.ceil(remaining / 1000)}s
          </Badge>
        )}
      </div>
      <div className="card-body">
        <div className={`value-box${revealed ? ' is-revealed' : ''}`}>
          {revealed ? (
            <code className="value-text mono">{value}</code>
          ) : (
            <span className="value-mask mono" aria-label="Hidden value">{maskFor(secret.id)}</span>
          )}
          <div className="value-actions">
            {revealed ? (
              <>
                <Button icon={EyeOff} onClick={hide}>Hide</Button>
                <Button icon={Copy} onClick={copy}>Copy</Button>
              </>
            ) : (
              <Button variant="primary" icon={Eye} loading={busy} onClick={reveal}>Reveal</Button>
            )}
          </div>
        </div>
        {revealed && (
          <div
            className="value-timer"
            role="progressbar"
            aria-label="Time until the value is hidden"
            aria-valuemin={0}
            aria-valuemax={REVEAL_MS / 1000}
            aria-valuenow={Math.ceil(remaining / 1000)}
          >
            <span style={{ width: `${(remaining / REVEAL_MS) * 100}%` }} />
          </div>
        )}
      </div>
    </section>
  );
}

// Clipboard API first; falls back to a temporary off-screen textarea that is
// removed immediately (e.g. when the async clipboard is blocked).
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(el);
    el.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    el.value = '';
    el.remove();
    return ok;
  }
}

// ---- Details ---------------------------------------------------------------
function DetailsCard({ secret }) {
  const { user } = useAuth();
  const [grants, setGrants] = useState(null);
  const caps = api.capabilities;

  useEffect(() => {
    if (!caps.listGrants) return undefined;
    let active = true;
    api.listGrants(secret.id).then(
      (g) => active && setGrants(g),
      () => active && setGrants(null),
    );
    return () => {
      active = false;
    };
  }, [secret.id, caps.listGrants]);

  let yourAccess = null;
  if (caps.listGrants && grants) {
    const mine = grants.members.find((m) => m.user.username === user.username);
    if (mine && mine.access !== 'none') yourAccess = <Badge tone="accent">{ACCESS_LABELS[mine.access]}</Badge>;
  } else if (!caps.listGrants && secret.isOwner) {
    // Real mode: ownership is the only access level we know for sure.
    yourAccess = <Badge tone="accent">Owner</Badge>;
  }
  const members = grants ? grants.members.filter((m) => m.access !== 'none').length : null;

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Details</h2>
      </div>
      <dl className="details-grid">
        <div>
          <dt>Owner</dt>
          <dd>
            <UserChip user={secret.owner} />
          </dd>
        </div>
        {yourAccess && (
          <div>
            <dt>Your access</dt>
            <dd>{yourAccess}</dd>
          </div>
        )}
        {caps.createdAt && secret.createdAt && (
          <div>
            <dt>Created</dt>
            <dd>{dateTime(secret.createdAt)}</dd>
          </div>
        )}
        <div>
          <dt>{secret.version > 1 ? 'Last rotated' : 'Last updated'}</dt>
          <dd>{dateTime(secret.updatedAt)}</dd>
        </div>
        <div>
          <dt>Encryption</dt>
          <dd className="mono details-mono">AES-256-GCM{api.mode === 'mock' ? ' · key v1' : ''}</dd>
        </div>
        {members !== null && (
          <div>
            <dt>People with access</dt>
            <dd>
              {members} member{members === 1 ? '' : 's'}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

// ---- Version history + recent activity (from the audit log) -----------------
function describe(e) {
  const who = e.actor.name;
  const ok = e.outcome !== 'denied';
  switch (e.action) {
    case 'secret.read':
      return ok ? `${who} revealed value` : `${who} tried to reveal value`;
    case 'secret.rotate':
      return ok ? `${who} rotated${e.version ? ` to v${e.version}` : ' value'}` : `${who} tried to rotate`;
    case 'secret.create':
      return `${who} created secret`;
    case 'secret.delete':
      return ok ? `${who} deleted secret` : `${who} tried to delete`;
    case 'permission.update':
      return ok ? `${who} changed access` : `${who} tried to change access`;
    case 'permission.revoke':
      return `${who} revoked access`;
    case 'secret.access':
      return `${who} was denied access`;
    default:
      return `${who} · ${e.action}`;
  }
}

// Newest rotation is the current version; count down from there when the
// backend doesn't say which version an event produced.
function buildHistory(secret, events) {
  const changes = events
    .filter((e) => e.outcome !== 'denied' && (e.action === 'secret.rotate' || e.action === 'secret.create'))
    .sort((a, b) => new Date(b.at) - new Date(a.at));
  const rows = changes.map((e, i) => ({
    version: e.version || (e.action === 'secret.create' ? 1 : secret.version - i),
    by: e.actor,
    at: e.at,
  }));
  if (!rows.length || rows[0].version !== secret.version) {
    rows.unshift({ version: secret.version, by: null, at: secret.updatedAt });
  }
  const seen = new Set();
  return rows
    .filter((r) => r.version >= 1 && r.version <= secret.version && !seen.has(r.version) && seen.add(r.version))
    .map((r) => ({
      ...r,
      label: r.version === secret.version ? 'Current' : r.version === 1 ? 'Created' : 'Rotated',
    }));
}

function SecretActivity({ secret }) {
  const { data: audit, error, loading } = usePolling(() => api.listAudit(), AUDIT_POLL_MS, [secret.id, secret.version]);
  const events = (audit || []).filter((e) => String(e.secretId) === String(secret.id));
  const history = buildHistory(secret, events);
  const shownVersions = new Set(history.map((h) => h.version));
  const hiddenCount = secret.version - shownVersions.size;
  const recent = events.slice(0, 5);

  return (
    <>
      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Version history</h2>
            <p className="card-sub">Old values stay encrypted and are never shown.</p>
          </div>
        </div>
        <ul className="list">
          {history.map((h) => (
            <li key={h.version} className="list-row">
              <VersionBadge version={h.version} />
              <div className="list-main">
                <span className="list-title">{h.label}</span>
                <span className="list-sub">
                  {h.by ? `by ${h.by.name} · ` : ''}
                  {shortDateTime(h.at)}
                </span>
              </div>
              {h.label === 'Current' ? <Badge tone="accent">Active</Badge> : <Badge tone="neutral">Archived</Badge>}
            </li>
          ))}
          {hiddenCount > 0 && !loading && (
            <li className="list-note">
              {hiddenCount === 1 ? '1 earlier version' : `${hiddenCount} earlier versions`} not in your audit log
            </li>
          )}
        </ul>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Recent activity</h2>
          <span className={`live ${error ? 'live-offline' : 'live-live'}`}>
            <span className="live-dot" aria-hidden />
            {error ? 'Offline' : 'Live'}
          </span>
        </div>
        {error && audit && <p className="list-note list-note-error">Couldn&apos;t refresh. Showing the last known activity.</p>}
        <ul className="list">
          {!audit && loading &&
            [0, 1, 2].map((i) => (
              <li key={i} className="list-row" aria-hidden>
                <span className="skeleton skeleton-circle" />
                <div className="list-main">
                  <span className="skeleton" style={{ width: `${55 - i * 10}%` }} />
                  <span className="skeleton" style={{ width: '22%', marginTop: 8 }} />
                </div>
              </li>
            ))}
          {!audit && error && <li className="list-note list-note-error">Couldn&apos;t load activity: {error.message}</li>}
          {audit && recent.length === 0 && <li className="list-note">No activity you can see yet.</li>}
          {recent.map((e) => (
            <li key={e.id} className="list-row">
              <Avatar user={e.actor} size="sm" />
              <div className="list-main">
                <span className="list-title">{describe(e)}</span>
                <span className="list-sub">{relativeTime(e.at)}</span>
              </div>
              <OutcomeBadge outcome={e.outcome} plain />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading secret">
      <div className="page-header">
        <div>
          <span className="skeleton" style={{ width: 240, height: 22 }} />
          <span className="skeleton" style={{ width: 320, display: 'block', marginTop: 14 }} />
        </div>
      </div>
      <div className="detail-grid">
        <div className="detail-col">
          <div className="card skeleton-card" />
          <div className="card skeleton-card tall" />
        </div>
        <div className="detail-col">
          <div className="card skeleton-card tall" />
        </div>
      </div>
    </div>
  );
}
