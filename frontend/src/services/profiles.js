// Cosmetic display data (avatar colour + initials) for users.
// Roles and emails are only attached by the mock API; the real backend has none.

const DEMO_COLORS = {
  mustapha: 'violet',
  tekena: 'teal',
  charity: 'orange',
  standford: 'pink',
  cd: 'green',
  cd_demo: 'green',
};

const PALETTE = ['violet', 'teal', 'orange', 'pink', 'green'];

export function colorFor(username = '') {
  const key = username.toLowerCase();
  if (DEMO_COLORS[key]) return DEMO_COLORS[key];
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function initialsFor(name = '') {
  const words = name.replace(/[_-]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words[1].length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] || '?').slice(0, 2).toUpperCase();
}

// Real-mode user: the username is the only identity the backend has.
export function profileFromUsername(id, username) {
  return {
    id,
    username,
    name: username,
    initials: initialsFor(username),
    color: colorFor(username),
  };
}

export function unknownUser(id) {
  return { id, username: null, name: `User #${id}`, initials: '#', color: 'slate' };
}
