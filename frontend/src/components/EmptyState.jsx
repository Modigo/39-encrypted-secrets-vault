export function EmptyState({ icon: Icon, title, children, action, tone = 'neutral' }) {
  return (
    <div className={`empty-state empty-${tone}`}>
      {Icon && (
        <span className="empty-icon">
          <Icon aria-hidden />
        </span>
      )}
      <h3 className="empty-title">{title}</h3>
      {children && <p className="empty-text">{children}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
