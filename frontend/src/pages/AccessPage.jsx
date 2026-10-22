import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, Info, KeyRound, Loader2, MoreHorizontal, Plus, ShieldOff, UserMinus, Users } from 'lucide-react';
import { useBreadcrumb } from '../components/Layout';
import { AccessDenied } from '../components/AccessDenied';
import { AuditLogCard } from '../components/AuditLogCard';
import { Avatar, UserChip } from '../components/Avatar';
import { ACCESS_LABELS, Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { Field, TextInput } from '../components/Input';
import { Menu } from '../components/Menu';
import { Modal } from '../components/Modal';
import { SkeletonRows, Table, TableMessageRow } from '../components/Table';
import { useToast } from '../components/Toast';
import { useSecrets } from '../context/SecretsContext';
import { api } from '../services/api';

const COLUMNS = [
  { key: 'member', label: 'Member', width: '37.7%' },
  { key: 'role', label: 'Role', width: '17.9%' },
  { key: 'access', label: 'Access' },
  { key: 'menu', label: '', srLabel: 'Actions', width: '64px' },
];

const ACCESS_ORDER = ['none', 'read', 'write'];

function accessMessage(username, access, secretName) {
  if (access === 'none') return `Removed ${username}'s access to ${secretName}`;
  return `${username} now has ${ACCESS_LABELS[access]} on ${secretName}`;
}

export function AccessPage() {
  useBreadcrumb([{ label: 'Vault', to: '/secrets' }, { label: 'Access control' }]);
  const { data: secrets, error: listError, refresh: refreshList } = useSecrets();
  const [params, setParams] = useSearchParams();
  const [denied, setDenied] = useState(null);

  const requested = params.get('secret');
  // Default to a secret you own: only owners can change access.
  const secret =
    secrets?.find((s) => String(s.id) === requested) || secrets?.find((s) => s.isOwner) || secrets?.[0] || null;

  if (denied) return <AccessDenied denied={denied} />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Access control &amp; audit</h1>
          <p className="page-sub">Control who can read or change each secret, and see every attempt to access it.</p>
        </div>
      </div>

      <div className="access-stack">
        <SecretSelect secrets={secrets} selected={secret} onSelect={(s) => setParams({ secret: String(s.id) }, { replace: true })} />

        {!secrets && listError ? (
          <div className="card">
            <EmptyState icon={KeyRound} tone="danger" title="Couldn't load secrets" action={<Button onClick={refreshList}>Try again</Button>}>
              {listError.message}
            </EmptyState>
          </div>
        ) : secrets && secrets.length === 0 ? (
          <div className="card">
            <EmptyState icon={KeyRound} title="No secrets to manage">
              Secrets you own or have access to will appear here.
            </EmptyState>
          </div>
        ) : (
          <PermissionsCard
            key={secret ? secret.id : 'loading'}
            secret={secret}
            onDenied={(action) => setDenied({ action, at: Date.now(), secretId: secret.id, secretName: secret.name })}
          />
        )}

        <AuditLogCard />
      </div>
    </>
  );
}

function SecretSelect({ secrets, selected, onSelect }) {
  return (
    <Menu
      className="secret-select"
      width="100%"
      items={(secrets || []).map((s) => ({
        key: String(s.id),
        label: <span className="mono">{s.name}</span>,
        selected: selected && s.id === selected.id,
        onSelect: () => onSelect(s),
      }))}
      trigger={({ open, toggle, ref }) => (
        <button
          ref={ref}
          type="button"
          className="select-btn"
          onClick={toggle}
          disabled={!secrets || secrets.length === 0}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Select secret"
        >
          <KeyRound className="select-lead" aria-hidden />
          <span className="select-label mono">{selected ? selected.name : secrets ? 'No secrets' : 'Loading…'}</span>
          <ChevronDown className="select-chevron" aria-hidden />
        </button>
      )}
    />
  );
}

function PermissionsCard({ secret, onDenied }) {
  const toast = useToast();
  const [grants, setGrants] = useState(null);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(null); // username being changed
  const [granting, setGranting] = useState(false);
  const onDeniedRef = useRef(onDenied);
  onDeniedRef.current = onDenied;
  const secretId = secret ? secret.id : null;

  const load = useCallback(async () => {
    if (secretId == null) return;
    try {
      setGrants(await api.listGrants(secretId));
      setError(null);
    } catch (err) {
      if (err.status === 403) onDeniedRef.current('read');
      else if (err.status !== 401) setError(err);
    }
  }, [secretId]);

  useEffect(() => {
    load();
  }, [load]);

  async function change(member, access) {
    if (member.access === access) return;
    const username = member.user.username;
    setPending(username);
    try {
      await api.setAccess(secret.id, username, access);
      toast.success(accessMessage(member.user.name, access, secret.name));
      await load();
    } catch (err) {
      if (err.status === 403) onDenied('grant');
      else if (err.status !== 401) toast.error(`Couldn't change access: ${err.message}`);
    } finally {
      setPending(null);
    }
  }

  const caps = api.capabilities;
  const members = grants ? grants.members : [];

  let body;
  if (!secret || (!grants && !error)) {
    body = <SkeletonRows columns={COLUMNS} rows={4} />;
  } else if (!grants && error) {
    body = (
      <TableMessageRow colSpan={COLUMNS.length}>
        <EmptyState icon={Users} tone="danger" title="Couldn't load permissions" action={<Button onClick={load}>Try again</Button>}>
          {error.message}
        </EmptyState>
      </TableMessageRow>
    );
  } else {
    body = members.map((m) => {
      // Owners (and Admins in mock mode) always have full access.
      const locked = m.isOwner || m.user.role === 'Admin';
      const busy = pending === m.user.username;
      return (
        <tr key={m.user.username || m.user.id}>
          <td>
            <UserChip user={m.user} size="sm" sub={caps.emails ? m.user.email : null} />
          </td>
          <td>{caps.roles ? m.user.role : m.isOwner ? <Badge tone="accent">Owner</Badge> : <span className="muted">{m.access === 'none' ? '—' : 'Granted'}</span>}</td>
          <td>
            <AccessSelect value={m.access} locked={locked} busy={busy} onChange={(a) => change(m, a)} />
          </td>
          <td className="cell-actions">
            <Menu
              align="right"
              items={[
                {
                  key: 'remove',
                  label: 'Remove access',
                  danger: true,
                  disabled: locked || m.access === 'none',
                  icon: <UserMinus className="menu-lucide" aria-hidden />,
                  onSelect: () => change(m, 'none'),
                },
              ]}
              trigger={({ open, toggle, ref }) => (
                <button ref={ref} type="button" className="icon-btn" aria-label={`More actions for ${m.user.name}`} aria-haspopup="menu" aria-expanded={open} onClick={toggle}>
                  <MoreHorizontal aria-hidden />
                </button>
              )}
            />
          </td>
        </tr>
      );
    });
  }

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">Permissions</h2>
          <p className="card-sub">Changes take effect immediately and are recorded in the audit log.</p>
        </div>
        <Button icon={Plus} onClick={() => setGranting(true)} disabled={!secret}>Grant access</Button>
      </div>
      {error && grants && (
        <div className="card-banner">
          <ErrorBanner title="Couldn't refresh permissions." onRetry={load} />
        </div>
      )}
      <Table columns={COLUMNS} label="Permissions" className="perm-table">{body}</Table>
      {grants && !grants.complete && (
        <p className="card-note">
          <Info aria-hidden />
          Showing the owner and access granted in this session. Existing grants can&apos;t be listed by the API yet.
        </p>
      )}
      {granting && (
        <GrantAccessModal
          secret={secret}
          members={members}
          onClose={() => setGranting(false)}
          onGranted={load}
          onDenied={() => onDenied('grant')}
        />
      )}
    </section>
  );
}

// Pill dropdown: No access / Read only / Read & write (mockup 03).
function AccessSelect({ value, locked, busy, onChange }) {
  const tone = value === 'write' ? 'accent' : value === 'read' ? 'neutral' : 'none';
  const pill = <span className={`access-pill access-${tone}`}>{ACCESS_LABELS[value]}</span>;
  if (locked) {
    return (
      <span className="access-trigger is-locked" title="Owners always have full access">
        {pill}
      </span>
    );
  }
  return (
    <Menu
      width={190}
      items={ACCESS_ORDER.map((a) => ({ key: a, label: ACCESS_LABELS[a], selected: a === value, onSelect: () => onChange(a) }))}
      trigger={({ open, toggle, ref }) => (
        <button ref={ref} type="button" className="access-trigger" onClick={toggle} disabled={busy} aria-haspopup="menu" aria-expanded={open} aria-label={`Access: ${ACCESS_LABELS[value]}`}>
          {pill}
          {busy ? <Loader2 className="access-chevron spin" aria-hidden /> : <ChevronDown className="access-chevron" aria-hidden />}
        </button>
      )}
    />
  );
}

function GrantAccessModal({ secret, members, onClose, onGranted, onDenied }) {
  const toast = useToast();
  const [users, setUsers] = useState(null);
  const [username, setUsername] = useState('');
  const [typing, setTyping] = useState(false);
  const [access, setAccess] = useState('read');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listUsers().then(setUsers, () => setUsers([]));
  }, []);

  const ownerNames = new Set(members.filter((m) => m.isOwner).map((m) => m.user.username));
  const candidates = (users || []).filter((u) => !ownerNames.has(u.username));
  const current = members.find((m) => m.user.username === username);
  const picked = candidates.find((u) => u.username === username);

  async function submit(e) {
    e.preventDefault();
    const name = username.trim();
    if (!name) {
      setError('Choose a member.');
      return;
    }
    setBusy(true);
    try {
      await api.setAccess(secret.id, name, access);
      toast.success(accessMessage(picked ? picked.name : name, access, secret.name));
      onGranted();
      onClose();
    } catch (err) {
      setBusy(false);
      if (err.status === 403) {
        onClose();
        onDenied();
      } else if (err.status === 404 || err.status === 400) {
        setError(err.message);
      } else if (err.status !== 401) {
        toast.error(`Couldn't grant access: ${err.message}`);
      }
    }
  }

  const memberItems = [
    ...candidates.map((u) => {
      const m = members.find((x) => x.user.username === u.username);
      return {
        key: u.username,
        label: u.name,
        sub: m && m.access !== 'none' ? `Currently ${ACCESS_LABELS[m.access]}` : u.email || null,
        icon: <Avatar user={u} size="sm" />,
        selected: u.username === username && !typing,
        onSelect: () => {
          setTyping(false);
          setUsername(u.username);
          setError(null);
        },
      };
    }),
    ...(api.mode === 'real'
      ? [
          ...(candidates.length ? [{ divider: true }] : []),
          {
            key: '__other',
            label: 'Other username…',
            onSelect: () => {
              setTyping(true);
              setUsername('');
              setError(null);
            },
          },
        ]
      : []),
  ];

  return (
    <Modal
      as="form"
      onSubmit={submit}
      title="Grant access"
      subtitle={
        <>
          Choose who can use <span className="mono">{secret.name}</span>.
        </>
      }
      onClose={onClose}
      busy={busy}
      width={460}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="primary" icon={Plus} loading={busy}>Grant access</Button>
        </>
      }
    >
      <Field label="Member" error={error}>
        {(p) =>
          typing ? (
            <TextInput {...p} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" autoComplete="off" spellCheck={false} autoFocus />
          ) : (
            <Menu
              className="field-menu"
              width="100%"
              items={memberItems}
              trigger={({ open, toggle, ref }) => (
                <button ref={ref} id={p.id} type="button" className="select-btn select-field" onClick={toggle} aria-haspopup="menu" aria-expanded={open} aria-invalid={p['aria-invalid']} disabled={!users}>
                  {picked ? <Avatar user={picked} size="sm" /> : null}
                  <span className={`select-label${picked ? '' : ' muted'}`}>{picked ? picked.name : users ? 'Choose a member' : 'Loading members…'}</span>
                  <ChevronDown className="select-chevron" aria-hidden />
                </button>
              )}
            />
          )
        }
      </Field>
      <Field label="Access">
        {() => (
          <div className="segmented" role="radiogroup" aria-label="Access level">
            {['read', 'write'].map((a) => (
              <button key={a} type="button" role="radio" aria-checked={access === a} className={`segment${access === a ? ' is-active' : ''}`} onClick={() => setAccess(a)}>
                {ACCESS_LABELS[a]}
              </button>
            ))}
          </div>
        )}
      </Field>
      {current && current.access !== 'none' && (
        <div className="info-box">
          <ShieldOff className="info-box-icon" aria-hidden />
          <p>
            {current.user.name} currently has <strong>{ACCESS_LABELS[current.access]}</strong>. Saving replaces it.
          </p>
        </div>
      )}
    </Modal>
  );
}
