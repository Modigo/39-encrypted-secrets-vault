import { Ban, Check } from 'lucide-react';

// tone: 'accent' | 'success' | 'danger' | 'warning' | 'neutral' | 'version'
export function Badge({ tone = 'neutral', icon: Icon, className = '', children }) {
  return (
    <span className={`badge badge-${tone} ${className}`}>
      {Icon && <Icon className="badge-icon" aria-hidden />}
      {children}
    </span>
  );
}

export function VersionBadge({ version }) {
  return <Badge tone="version" className="mono">v{version}</Badge>;
}

// plain: no icon (recent activity in mockup 05); icons in the audit log (mockup 03).
export function OutcomeBadge({ outcome, plain = false }) {
  return outcome === 'denied' ? (
    <Badge tone="danger" icon={plain ? undefined : Ban}>Denied</Badge>
  ) : (
    <Badge tone="success" icon={plain ? undefined : Check}>Success</Badge>
  );
}

export const ACCESS_LABELS = { none: 'No access', read: 'Read only', write: 'Read & write' };
