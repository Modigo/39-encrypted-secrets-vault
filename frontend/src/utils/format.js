const MIN = 60_000;
const HOUR = 60 * MIN;

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const pad = (n) => String(n).padStart(2, '0');

export function clock(value, withSeconds = false) {
  const d = new Date(value);
  return withSeconds ? `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function shortDate(value) {
  const d = new Date(value);
  const opts = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}

// "Just now", "2 min ago", "1 hour ago", "Today, 09:12", "Yesterday", "Oct 19"
export function relativeTime(value, now = Date.now()) {
  if (!value) return '—';
  const d = new Date(value);
  const diff = now - d.getTime();
  const today = new Date(now);
  if (diff < MIN) return 'Just now';
  if (diff < HOUR) return `${Math.floor(diff / MIN)} min ago`;
  if (diff < 3 * HOUR && sameDay(d, today)) {
    const h = Math.floor(diff / HOUR);
    return `${h} hour${h === 1 ? '' : 's'} ago`;
  }
  if (sameDay(d, today)) return `Today, ${clock(d)}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(d, yesterday)) return 'Yesterday';
  return shortDate(d);
}

// "Oct 18, 2026 · 11:05" / "Today · 09:12"
export function dateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (sameDay(d, new Date())) return `Today · ${clock(d)}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${clock(d)}`;
}

// "Today, 09:12" / "Oct 20, 16:40" (version history)
export function shortDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (sameDay(d, new Date())) return `Today, ${clock(d)}`;
  return `${shortDate(d)}, ${clock(d)}`;
}

// Fixed-length-ish mask that never depends on the real value.
export function maskFor(id) {
  const n = Number(id) || 0;
  return '•'.repeat(14 + ((n * 7) % 12));
}

export function pad2(n) {
  return pad(n);
}
