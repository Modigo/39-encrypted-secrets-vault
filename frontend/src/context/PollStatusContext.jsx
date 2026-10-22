import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// Feeds the top bar's "Live · refreshed Xs ago" from whichever poll last ran.
const PollStatusContext = createContext(null);

export function PollStatusProvider({ children }) {
  const [status, setStatus] = useState({ lastSuccess: null, failing: false });

  const reportSuccess = useCallback((time) => setStatus({ lastSuccess: time, failing: false }), []);
  const reportFailure = useCallback(() => setStatus((s) => (s.failing ? s : { ...s, failing: true })), []);
  const reset = useCallback(() => setStatus({ lastSuccess: null, failing: false }), []);

  const value = useMemo(
    () => ({ ...status, reportSuccess, reportFailure, reset }),
    [status, reportSuccess, reportFailure, reset],
  );
  return <PollStatusContext.Provider value={value}>{children}</PollStatusContext.Provider>;
}

export function usePollStatus() {
  return useContext(PollStatusContext);
}
