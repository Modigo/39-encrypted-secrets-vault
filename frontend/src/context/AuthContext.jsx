import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken, setUnauthorizedHandler } from '../services/api';

// Current user + bearer token. The token is held in memory only (api.js module
// state), so a page reload signs you out by design.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Verifies the token first; on failure the current session is left untouched,
  // so a bad switch in the "Acting as" menu doesn't sign you out.
  const signIn = useCallback(async (token) => {
    const nextUser = await api.signIn(token);
    setAuthToken(token);
    setUser(nextUser);
    setSessionExpired(false);
    return nextUser;
  }, []);

  const signOut = useCallback(() => {
    setAuthToken(null);
    api.signOut();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAuthToken(null);
      api.signOut();
      setUser(null);
      setSessionExpired(true);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const value = useMemo(
    () => ({ user, signIn, signOut, sessionExpired }),
    [user, signIn, signOut, sessionExpired],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
