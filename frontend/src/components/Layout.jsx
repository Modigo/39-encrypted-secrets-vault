import { createContext, useContext, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ChevronDown, KeyRound, List, Lock, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePollStatus } from '../context/PollStatusContext';
import { SecretsProvider, useSecrets } from '../context/SecretsContext';
import { api } from '../services/api';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Menu } from './Menu';
import { useToast } from './Toast';

// Pages call useBreadcrumb([...]) to fill the top bar trail.
const BreadcrumbContext = createContext(() => {});

export function useBreadcrumb(items) {
  const set = useContext(BreadcrumbContext);
  const key = JSON.stringify(items);
  useEffect(() => {
    set(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set, key]);
}

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-logo">
        <Lock aria-hidden />
      </span>
      <span className="brand-text">
        <span className="brand-name">SecretsVault</span>
        <span className="brand-sub">Encrypted secrets</span>
      </span>
    </div>
  );
}

export function Layout() {
  const { user } = useAuth();
  const [crumbs, setCrumbs] = useState([]);
  return (
    <SecretsProvider>
      <BreadcrumbContext.Provider value={setCrumbs}>
        <div className="app">
          <Sidebar />
          <div className="app-main">
            <Topbar crumbs={crumbs} />
            <main className="page">
              {/* Remount the page when the acting user changes: drops filters, open modals and any revealed value. */}
              <Outlet key={user.username} />
            </main>
          </div>
        </div>
      </BreadcrumbContext.Provider>
    </SecretsProvider>
  );
}

function Sidebar() {
  const { data: secrets } = useSecrets();
  return (
    <aside className="sidebar">
      <Link to="/secrets" className="sidebar-brand">
        <Brand />
      </Link>
      <div className="sidebar-label">Vault</div>
      <nav className="sidebar-nav">
        <NavLink to="/secrets" className="nav-item">
          <KeyRound className="nav-icon" aria-hidden />
          <span>Secrets</span>
          {secrets && <span className="nav-count">{secrets.length}</span>}
        </NavLink>
        <NavLink to="/access" className="nav-item">
          <Shield className="nav-icon" aria-hidden />
          <span>Access control</span>
        </NavLink>
        <NavLink to="/audit" className="nav-item">
          <List className="nav-icon" aria-hidden />
          <span>Audit log</span>
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-label">Acting as (demo)</div>
        <ActingAs />
      </div>
    </aside>
  );
}

function ActingAs() {
  const { user, signIn, signOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    api.demoAccounts().then(setAccounts, () => setAccounts([]));
  }, []);

  async function switchTo(account) {
    if (account.username === user.username) return;
    setSwitching(true);
    try {
      const next = await signIn(account.token);
      toast.success(`Now acting as ${next.name}`);
    } catch (err) {
      toast.error(`Couldn't switch to ${account.name}: ${err.message}`);
    } finally {
      setSwitching(false);
    }
  }

  const items = [
    ...accounts.map((a) => ({
      key: a.username,
      label: a.name,
      sub: a.role,
      icon: <Avatar user={a} size="sm" />,
      selected: a.username === user.username,
      onSelect: () => switchTo(a),
    })),
    ...(accounts.length ? [{ divider: true }] : []),
    {
      key: '__signout',
      label: 'Sign out',
      icon: <LogOut className="menu-lucide" aria-hidden />,
      onSelect: () => {
        signOut();
        navigate('/login', { replace: true });
      },
    },
  ];

  return (
    <Menu
      placement="top"
      width="100%"
      className="acting-as"
      items={items}
      trigger={({ open, toggle, ref }) => (
        <button ref={ref} type="button" className="acting-card" onClick={toggle} aria-haspopup="menu" aria-expanded={open} aria-busy={switching || undefined}>
          <Avatar user={user} size="lg" />
          <span className="acting-text">
            <span className="acting-name">{user.name}</span>
            {user.role && <span className="acting-role">{user.role}</span>}
          </span>
          <ChevronDown className="acting-chevron" aria-hidden />
        </button>
      )}
    />
  );
}

function Topbar({ crumbs }) {
  const { user } = useAuth();
  return (
    <header className="topbar">
      <nav className="crumbs" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <span key={i} className="crumb-wrap">
            {i > 0 && <span className="crumb-sep">/</span>}
            {c.to && i < crumbs.length - 1 ? (
              <Link to={c.to} className="crumb">{c.label}</Link>
            ) : (
              <span className={i === crumbs.length - 1 ? 'crumb crumb-current' : 'crumb'}>{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="topbar-right">
        <LiveStatus />
        <span className="topbar-divider" />
        <span className="topbar-user">
          <Avatar user={user} size="sm" />
          <span className="topbar-name">{user.name}</span>
          {user.role && <Badge tone="accent">{user.role}</Badge>}
        </span>
      </div>
    </header>
  );
}

function secondsSince(t, now) {
  return Math.max(0, Math.round((now - t) / 1000));
}

function formatAgo(sec) {
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

// "Live · refreshed Xs ago" = real time since the last successful poll.
function LiveStatus() {
  const { lastSuccess, failing } = usePollStatus();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  let tone = 'live';
  let text = 'Connecting…';
  if (failing) {
    tone = 'offline';
    text = lastSuccess ? `Offline · last refreshed ${formatAgo(secondsSince(lastSuccess, now))}` : 'Offline';
  } else if (lastSuccess) {
    text = `Live · refreshed ${formatAgo(secondsSince(lastSuccess, now))}`;
  } else {
    tone = 'pending';
  }
  return (
    <span className={`live live-${tone}`} role="status" aria-live="off">
      <span className="live-dot" aria-hidden />
      {text}
    </span>
  );
}
