import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Clock, Loader2, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Avatar } from '../components/Avatar';
import { Brand } from '../components/Layout';
import { Button } from '../components/Button';
import { Field, SecretInput, TextInput } from '../components/Input';

// The three tiles shown in mockup 04 (Admin, Owner, limited Viewer).
const TILE_ORDER = ['mustapha', 'tekena', 'cd'];

function pickTiles(accounts) {
  const tiles = TILE_ORDER.map((base) => accounts.find((a) => a.username === base || a.username.startsWith(`${base}_`))).filter(Boolean);
  return tiles.length ? tiles : accounts.slice(0, 3);
}

function tileSub(account) {
  if (!account.role) return 'Demo account';
  return account.role === 'Viewer' ? 'Viewer · limited' : account.role;
}

// Mockup 04. Mock mode keeps the mockup's Email + Password form; real mode uses
// Username + Access token because the backend only issues bearer tokens.
export function LoginPage() {
  const { user, signIn, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const real = api.mode === 'real';
  const [accounts, setAccounts] = useState(null);
  const [form, setForm] = useState({ id: '', secret: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(null); // 'form' | username

  useEffect(() => {
    api.demoAccounts().then(setAccounts, () => setAccounts([]));
  }, []);

  const destination = location.state?.from && location.state.from !== '/login' ? location.state.from : '/secrets';
  if (user) return <Navigate to={destination} replace />;

  async function finish(token, expectedUsername) {
    // Check the token's owner before committing the session.
    if (expectedUsername) {
      const owner = await api.signIn(token);
      if (owner.username !== expectedUsername) throw Object.assign(new Error('mismatch'), { status: 401 });
    }
    await signIn(token);
    navigate(destination, { replace: true });
  }

  async function submit(e) {
    e.preventDefault();
    const id = form.id.trim();
    const secret = form.secret.trim();
    const found = {};
    if (!id) found.id = real ? 'Enter your username.' : 'Enter your email.';
    else if (!real && !/^[^\s@]+@[^\s@]+$/.test(id)) found.id = 'Enter a valid email address.';
    if (!secret) found.secret = real ? 'Paste your access token.' : 'Enter your password.';
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;

    setBusy('form');
    try {
      if (real) await finish(secret, id);
      else await finish(await api.tokenForCredentials(id, secret));
    } catch (err) {
      setFormError(err.status === 401 ? (real ? 'Invalid username or access token.' : err.message) : err.message);
      setBusy(null);
    }
  }

  async function signInAs(account) {
    setBusy(account.username);
    setFormError('');
    try {
      await finish(account.token);
    } catch (err) {
      setFormError(
        err.status === 401
          ? `The demo token for ${account.name} was rejected. Re-run npm run seed:demo against this database.`
          : err.message,
      );
      setBusy(null);
    }
  }

  const tiles = accounts ? pickTiles(accounts) : [];

  return (
    <div className="login-page">
      <main className="login-card">
        <Brand />
        <h1 className="login-title">Sign in to your vault</h1>
        <p className="login-sub">Use your team account to access secrets you have permission to see.</p>

        {sessionExpired && (
          <div className="login-alert login-alert-warning" role="status">
            <Clock aria-hidden />
            Your session expired. Sign in again to continue.
          </div>
        )}

        <form className="login-form" onSubmit={submit} noValidate>
          <Field label={real ? 'Username' : 'Email'} error={errors.id}>
            {(p) => (
              <TextInput
                {...p}
                type={real ? 'text' : 'email'}
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                placeholder={real ? 'tekena' : 'tekena@team.dev'}
                autoComplete="username"
                spellCheck={false}
                autoCapitalize="off"
              />
            )}
          </Field>
          <Field label={real ? 'Access token' : 'Password'} error={errors.secret}>
            {(p) => (
              <SecretInput
                {...p}
                className="login-secret"
                value={form.secret}
                onChange={(e) => setForm({ ...form, secret: e.target.value })}
                placeholder={real ? 'Paste your access token' : ''}
              />
            )}
          </Field>

          {formError && (
            <div className="login-alert login-alert-error" role="alert">
              <AlertCircle aria-hidden />
              {formError}
            </div>
          )}

          <Button type="submit" variant="primary" block loading={busy === 'form'} disabled={Boolean(busy)} className="login-submit">
            Sign in
          </Button>
        </form>

        <div className="login-divider">
          <span>Demo accounts (prototype)</span>
        </div>

        {accounts && tiles.length === 0 ? (
          <p className="login-note">
            No demo accounts configured. Run <code className="mono">npm run seed:demo</code> and restart the dev server.
          </p>
        ) : (
          <div className="login-tiles">
            {(accounts ? tiles : [null, null, null]).map((a, i) =>
              a ? (
                <button key={a.username} type="button" className="login-tile" onClick={() => signInAs(a)} disabled={Boolean(busy)} aria-label={`Sign in as ${a.name}`}>
                  {busy === a.username ? <Loader2 className="login-tile-spin spin" aria-hidden /> : <Avatar user={a} size="sm" />}
                  <span className="login-tile-name">{a.name}</span>
                  <span className="login-tile-role">{tileSub(a)}</span>
                </button>
              ) : (
                <span key={i} className="login-tile is-loading" aria-hidden>
                  <span className="skeleton skeleton-circle" />
                  <span className="skeleton" style={{ width: '70%', marginTop: 10 }} />
                </span>
              ),
            )}
          </div>
        )}
      </main>
      <p className="login-foot">
        <Lock aria-hidden />
        Secrets are encrypted with AES-256-GCM before they are stored.
      </p>
    </div>
  );
}
