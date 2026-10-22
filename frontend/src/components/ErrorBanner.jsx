import { AlertTriangle, RotateCw } from 'lucide-react';

// Inline banner, e.g. "Couldn't refresh … showing data from 30s ago".
export function ErrorBanner({ title, children, onRetry, retrying = false }) {
  return (
    <div className="error-banner" role="alert">
      <AlertTriangle className="error-banner-icon" aria-hidden />
      <div className="error-banner-text">
        {title && <strong>{title}</strong>}
        {children && <span>{children}</span>}
      </div>
      {onRetry && (
        <button type="button" className="error-banner-retry" onClick={onRetry} disabled={retrying}>
          <RotateCw className={retrying ? 'spin' : undefined} aria-hidden />
          Retry
        </button>
      )}
    </div>
  );
}
