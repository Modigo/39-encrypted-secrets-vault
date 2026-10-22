import { useNavigate } from 'react-router-dom';
import { Ban } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { clock } from '../utils/format';
import { Badge } from './Badge';
import { Button } from './Button';

const VERBS = {
  read: { verb: 'read', action: 'secret.read' },
  rotate: { verb: 'rotate', action: 'secret.rotate' },
  delete: { verb: 'delete', action: 'secret.delete' },
  grant: { verb: 'change access to', action: 'permission.update' },
};

// The backend audits denied reads/rotates; owner-only checks (delete, grant)
// are only logged when the user had no access at all, so don't claim it then.
function isRecorded(action) {
  return api.mode === 'mock' || action === 'read' || action === 'rotate';
}

// 403 state (mockup 06). `denied` = { action, at, secretName, secretId }
export function AccessDenied({ denied }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { verb, action } = VERBS[denied.action] || VERBS.read;
  const name = denied.secretName || `secret #${denied.secretId}`;
  const who = user.role ? `${user.name} · ${user.role}` : user.name;

  return (
    <div className="denied-wrap">
      <section className="denied-card" aria-labelledby="denied-title">
        <span className="denied-icon">
          <Ban aria-hidden />
        </span>
        <Badge tone="danger">403 · Access denied</Badge>
        <h1 id="denied-title" className="denied-title">You don&apos;t have access to this secret</h1>
        <p className="denied-text">
          Your account (<strong>{who}</strong>) has no permission to {verb} <span className="mono denied-name">{name}</span>.
          {isRecorded(denied.action) && ' This attempt has been recorded in the audit log.'}
        </p>
        <div className="denied-log mono" aria-label="Audit entry">
          <span className="denied-log-time">{clock(denied.at, true)}</span>
          <span>{user.email || user.username}</span>
          <span>{action}</span>
          <span>{name}</span>
          <span className="denied-log-outcome">DENIED</span>
        </div>
        <div className="denied-actions">
          <Button onClick={() => navigate('/secrets')}>Back to secrets</Button>
          <Button variant="primary" title="Access requests aren't available yet">Request access</Button>
        </div>
      </section>
    </div>
  );
}
