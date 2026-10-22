import { createContext, useContext } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import { usePolling } from '../hooks/usePolling';

export const SECRETS_POLL_MS = 10_000;

// One shared poll of GET /api/secrets (metadata only) for the sidebar count,
// the dashboard, the detail header and the access-control selector.
const SecretsContext = createContext(null);

export function SecretsProvider({ children }) {
  const { user } = useAuth();
  const poll = usePolling(() => api.listSecrets(), SECRETS_POLL_MS, [user && user.id]);
  return <SecretsContext.Provider value={poll}>{children}</SecretsContext.Provider>;
}

export function useSecrets() {
  return useContext(SecretsContext);
}
