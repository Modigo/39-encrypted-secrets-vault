// Initials circle. size: 'sm' (24px) | 'md' (28px) | 'lg' (30px)
export function Avatar({ user, size = 'sm' }) {
  if (!user) return null;
  return (
    <span className={`avatar avatar-${size} av-${user.color || 'slate'}`} aria-hidden>
      {user.initials}
    </span>
  );
}

export function UserChip({ user, size = 'sm', sub }) {
  if (!user) return <span className="muted">—</span>;
  return (
    <span className="user-chip">
      <Avatar user={user} size={size} />
      <span className="user-chip-text">
        <span className="user-chip-name">{user.name}</span>
        {sub && <span className="user-chip-sub">{sub}</span>}
      </span>
    </span>
  );
}
