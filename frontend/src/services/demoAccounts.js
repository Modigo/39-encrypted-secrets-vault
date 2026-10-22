// Demo accounts for the login tiles and the sidebar "Acting as" switcher (real mode).
// `npm run seed:demo` writes VITE_DEMO_ACCOUNTS to .env.local. These tokens belong
// to a local seeded database only; .env.local is gitignored.
function parseAccounts(raw) {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list)
      ? list.filter((a) => a && typeof a.username === 'string' && typeof a.token === 'string')
      : [];
  } catch {
    return [];
  }
}

export const demoAccounts = parseAccounts(import.meta.env.VITE_DEMO_ACCOUNTS);
