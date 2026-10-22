import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, Eye, KeyRound, Lock, MoreHorizontal, Plus, RotateCw, Search, SearchX, Trash2, User } from 'lucide-react';
import { useBreadcrumb } from '../components/Layout';
import { useSecrets } from '../context/SecretsContext';
import { Avatar, UserChip } from '../components/Avatar';
import { VersionBadge } from '../components/Badge';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { TextInput } from '../components/Input';
import { Menu } from '../components/Menu';
import { SkeletonRows, Table, TableMessageRow } from '../components/Table';
import { AddSecretModal, DeleteSecretModal, RotateSecretModal } from '../components/SecretModals';
import { clock, maskFor, pad2, relativeTime } from '../utils/format';

const COLUMNS = [
  { key: 'n', label: '#', width: '48px' },
  { key: 'name', label: 'Name', width: '17%' },
  { key: 'value', label: 'Value', width: '29%' },
  { key: 'version', label: 'Version', width: '8.7%' },
  { key: 'owner', label: 'Owner', width: '15%' },
  { key: 'updated', label: 'Last updated', width: '14%' },
  { key: 'actions', label: '', srLabel: 'Actions', width: '124px' },
];

export function SecretsPage() {
  useBreadcrumb([{ label: 'Vault', to: '/secrets' }, { label: 'Secrets' }]);
  const navigate = useNavigate();
  const { data: secrets, error, loading, lastUpdated, refresh } = useSecrets();
  const [query, setQuery] = useState('');
  const [ownerKey, setOwnerKey] = useState('all');
  const [adding, setAdding] = useState(false);
  const [rotating, setRotating] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const owners = useMemo(() => {
    const map = new Map();
    for (const s of secrets || []) map.set(String(s.owner.id), s.owner);
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [secrets]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (secrets || []).filter(
      (s) => (!q || s.name.toLowerCase().includes(q)) && (ownerKey === 'all' || String(s.owner.id) === ownerKey),
    );
  }, [secrets, query, ownerKey]);

  const selectedOwner = owners.find(([k]) => k === ownerKey);
  const filtering = query.trim() !== '' || ownerKey !== 'all';

  function showDenied(secret, action) {
    navigate(`/secrets/${secret.id}`, {
      state: { denied: { action, at: Date.now(), secretName: secret.name, secretId: secret.id } },
    });
  }

  function clearFilters() {
    setQuery('');
    setOwnerKey('all');
  }

  let body;
  if (!secrets && loading) {
    body = <SkeletonRows columns={COLUMNS} rows={8} />;
  } else if (!secrets && error) {
    body = (
      <TableMessageRow colSpan={COLUMNS.length}>
        <EmptyState icon={KeyRound} tone="danger" title="Couldn't load secrets" action={<Button onClick={refresh}>Try again</Button>}>
          {error.message}
        </EmptyState>
      </TableMessageRow>
    );
  } else if (secrets.length === 0) {
    body = (
      <TableMessageRow colSpan={COLUMNS.length}>
        <EmptyState
          icon={KeyRound}
          title="No secrets yet"
          action={<Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>Add secret</Button>}
        >
          Secrets you own or have been granted access to will appear here.
        </EmptyState>
      </TableMessageRow>
    );
  } else if (visible.length === 0) {
    body = (
      <TableMessageRow colSpan={COLUMNS.length}>
        <EmptyState icon={SearchX} title="No matching secrets" action={<Button onClick={clearFilters}>Clear filters</Button>}>
          Nothing matches your search{ownerKey !== 'all' ? ' and owner filter' : ''}.
        </EmptyState>
      </TableMessageRow>
    );
  } else {
    body = visible.map((s, i) => (
      <tr key={s.id} className="row-link" onClick={() => navigate(`/secrets/${s.id}`)}>
        <td className="mono cell-index">{pad2(i + 1)}</td>
        <td>
          <Link to={`/secrets/${s.id}`} className="mono cell-name" onClick={(e) => e.stopPropagation()}>
            {s.name}
          </Link>
        </td>
        <td className="mono cell-mask" aria-label="Hidden value">{maskFor(s.id)}</td>
        <td>
          <VersionBadge version={s.version} />
        </td>
        <td>
          <UserChip user={s.owner} />
        </td>
        <td className="cell-time" title={new Date(s.updatedAt).toLocaleString()}>{relativeTime(s.updatedAt)}</td>
        <td className="cell-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="icon-btn" title="Reveal" aria-label={`Reveal ${s.name}`} onClick={() => navigate(`/secrets/${s.id}`)}>
            <Eye aria-hidden />
          </button>
          <button type="button" className="icon-btn" title="Rotate" aria-label={`Rotate ${s.name}`} onClick={() => setRotating(s)}>
            <RotateCw aria-hidden />
          </button>
          <Menu
            align="right"
            items={[
              { key: 'open', label: 'Open', icon: <Eye className="menu-lucide" aria-hidden />, onSelect: () => navigate(`/secrets/${s.id}`) },
              { key: 'rotate', label: 'Rotate', icon: <RotateCw className="menu-lucide" aria-hidden />, onSelect: () => setRotating(s) },
              { divider: true },
              { key: 'delete', label: 'Delete', danger: true, icon: <Trash2 className="menu-lucide" aria-hidden />, onSelect: () => setDeleting(s) },
            ]}
            trigger={({ open, toggle, ref }) => (
              <button ref={ref} type="button" className="icon-btn" aria-label={`More actions for ${s.name}`} aria-haspopup="menu" aria-expanded={open} onClick={toggle}>
                <MoreHorizontal aria-hidden />
              </button>
            )}
          />
        </td>
      </tr>
    ));
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Secrets</h1>
          <p className="page-sub">Values are hidden by default. Open a secret to reveal or rotate it.</p>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>Add secret</Button>
        </div>
      </div>

      <div className="filters">
        <TextInput
          icon={Search}
          className="filters-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search secrets by name..."
          aria-label="Search secrets by name"
        />
        <Menu
          align="right"
          className="filters-owner"
          width="100%"
          items={[
            { key: 'all', label: 'All owners', selected: ownerKey === 'all', onSelect: () => setOwnerKey('all') },
            ...owners.map(([k, o]) => ({
              key: k,
              label: o.name,
              icon: <Avatar user={o} size="sm" />,
              selected: ownerKey === k,
              onSelect: () => setOwnerKey(k),
            })),
          ]}
          trigger={({ open, toggle, ref }) => (
            <button ref={ref} type="button" className="select-btn" onClick={toggle} aria-haspopup="menu" aria-expanded={open}>
              <User className="select-lead" aria-hidden />
              <span className="select-label">{selectedOwner ? selectedOwner[1].name : 'All owners'}</span>
              <ChevronDown className="select-chevron" aria-hidden />
            </button>
          )}
        />
      </div>

      {error && secrets && (
        <ErrorBanner title="Couldn't refresh secrets." onRetry={refresh}>
          Showing data last loaded at {clock(lastUpdated, true)}. Retrying automatically.
        </ErrorBanner>
      )}

      <div className="card">
        <Table columns={COLUMNS} label="Secrets">{body}</Table>
      </div>

      {secrets && secrets.length > 0 && (
        <p className="table-footnote">
          <Lock aria-hidden />
          {filtering ? `${visible.length} of ${secrets.length}` : secrets.length} secret{secrets.length === 1 ? '' : 's'} · encrypted at rest
          with AES-256-GCM · you only see secrets you have access to
        </p>
      )}

      {adding && <AddSecretModal onClose={() => setAdding(false)} onCreated={refresh} />}
      {rotating && (
        <RotateSecretModal
          secret={rotating}
          onClose={() => setRotating(null)}
          onRotated={refresh}
          onDenied={() => showDenied(rotating, 'rotate')}
        />
      )}
      {deleting && (
        <DeleteSecretModal
          secret={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={refresh}
          onDenied={() => showDenied(deleting, 'delete')}
        />
      )}
    </>
  );
}
