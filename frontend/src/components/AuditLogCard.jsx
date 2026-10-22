import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ListX, ScrollText } from 'lucide-react';
import { usePolling } from '../hooks/usePolling';
import { api } from '../services/api';
import { clock, shortDate } from '../utils/format';
import { UserChip } from './Avatar';
import { OutcomeBadge } from './Badge';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { ErrorBanner } from './ErrorBanner';
import { Menu } from './Menu';
import { SkeletonRows, Table, TableMessageRow } from './Table';

export const AUDIT_POLL_MS = 5_000;

const COLUMNS = [
  { key: 'time', label: 'Time', width: '13.6%' },
  { key: 'actor', label: 'Actor', width: '21.8%' },
  { key: 'action', label: 'Action', width: '23.6%' },
  { key: 'secret', label: 'Secret', width: '23.6%' },
  { key: 'outcome', label: 'Outcome' },
];

const OUTCOMES = [
  { key: 'all', label: 'All outcomes' },
  { key: 'success', label: 'Success' },
  { key: 'denied', label: 'Denied' },
];

function eventTime(at) {
  const d = new Date(at);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? clock(d, true) : `${shortDate(d)} ${clock(d)}`;
}

// Audit log card (mockup 03). Polls GET /api/audit; never contains secret values.
export function AuditLogCard() {
  const { data: events, error, loading, lastUpdated, refresh } = usePolling(() => api.listAudit(), AUDIT_POLL_MS);
  const [outcome, setOutcome] = useState('all');

  // Highlight rows that arrive after the first load.
  const seen = useRef(null);
  const [fresh, setFresh] = useState(() => new Set());
  useEffect(() => {
    if (!events) return;
    const ids = new Set(events.map((e) => e.id));
    if (seen.current) {
      const added = events.filter((e) => !seen.current.has(e.id)).map((e) => e.id);
      if (added.length) setFresh(new Set(added));
    }
    seen.current = ids;
  }, [events]);

  const visible = (events || []).filter((e) => outcome === 'all' || e.outcome === outcome);
  const selected = OUTCOMES.find((o) => o.key === outcome);

  let body;
  if (!events && loading) {
    body = <SkeletonRows columns={COLUMNS} rows={6} />;
  } else if (!events && error) {
    body = (
      <TableMessageRow colSpan={COLUMNS.length}>
        <EmptyState icon={ScrollText} tone="danger" title="Couldn't load the audit log" action={<Button onClick={refresh}>Try again</Button>}>
          {error.message}
        </EmptyState>
      </TableMessageRow>
    );
  } else if (events.length === 0) {
    body = (
      <TableMessageRow colSpan={COLUMNS.length}>
        <EmptyState icon={ScrollText} title="No audit events yet">
          Reads, rotations and permission changes on your secrets will show up here.
        </EmptyState>
      </TableMessageRow>
    );
  } else if (visible.length === 0) {
    body = (
      <TableMessageRow colSpan={COLUMNS.length}>
        <EmptyState icon={ListX} title={`No ${outcome === 'denied' ? 'denied' : 'successful'} events`} action={<Button onClick={() => setOutcome('all')}>Show all outcomes</Button>} />
      </TableMessageRow>
    );
  } else {
    body = visible.map((e) => (
      <tr
        key={e.id}
        className={`${e.outcome === 'denied' ? 'row-denied' : ''}${fresh.has(e.id) ? ' row-fresh' : ''}`}
      >
        <td className="mono audit-time" title={new Date(e.at).toLocaleString()}>{eventTime(e.at)}</td>
        <td>
          <UserChip user={e.actor} />
        </td>
        <td className="mono audit-mono">{e.action}</td>
        <td className="mono audit-mono">{e.secretName || (e.secretId != null ? `#${e.secretId}` : '—')}</td>
        <td>
          <OutcomeBadge outcome={e.outcome} />
        </td>
      </tr>
    ));
  }

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">Audit log</h2>
          <p className="card-sub">Secret values are never recorded.</p>
        </div>
        <div className="card-tools">
          <span className={`live ${error ? 'live-offline' : 'live-live'}`}>
            <span className="live-dot" aria-hidden />
            {error ? 'Offline' : 'Live'}
          </span>
          <Menu
            align="right"
            width={160}
            items={OUTCOMES.map((o) => ({ key: o.key, label: o.label, selected: o.key === outcome, onSelect: () => setOutcome(o.key) }))}
            trigger={({ open, toggle, ref }) => (
              <button ref={ref} type="button" className="select-btn select-sm" onClick={toggle} aria-haspopup="menu" aria-expanded={open} aria-label="Filter by outcome">
                <span className="select-label">{selected.label}</span>
                <ChevronDown className="select-chevron" aria-hidden />
              </button>
            )}
          />
        </div>
      </div>
      {error && events && (
        <div className="card-banner">
          <ErrorBanner title="Couldn't refresh the audit log." onRetry={refresh}>
            Showing events last loaded at {clock(lastUpdated, true)}. Retrying automatically.
          </ErrorBanner>
        </div>
      )}
      <Table columns={COLUMNS} label="Audit log" className="audit-table">{body}</Table>
    </section>
  );
}
