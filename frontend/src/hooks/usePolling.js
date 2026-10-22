import { useCallback, useEffect, useRef, useState } from 'react';
import { usePollStatus } from '../context/PollStatusContext';

// Polls `fn` every `intervalMs`. Only ever use it for metadata/audit, never secret values.
// - No overlapping requests: the next tick is scheduled after the previous one settles.
// - Pauses while the tab is hidden and refreshes as soon as it's visible again.
// - Keeps the last good `data` when a poll fails (`error` is set instead).
// - Restarts (and clears data) when anything in `deps` changes.
export function usePolling(fn, intervalMs, deps = []) {
  const [data, setData] = useState(undefined);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);

  const fnRef = useRef(fn);
  fnRef.current = fn;
  const runRef = useRef(null);
  const pollStatus = usePollStatus();
  const statusRef = useRef(pollStatus);
  statusRef.current = pollStatus;

  useEffect(() => {
    let active = true;
    let timer = null;
    let inFlight = false;
    let rerun = false;

    setData(undefined);
    setError(null);
    setLoading(true);

    async function run() {
      if (!active) return;
      if (inFlight) {
        rerun = true;
        return;
      }
      clearTimeout(timer);
      inFlight = true;
      try {
        const result = await fnRef.current();
        if (!active) return;
        const now = Date.now();
        setData(result);
        setError(null);
        setLastUpdated(now);
        statusRef.current?.reportSuccess(now);
      } catch (err) {
        if (!active) return;
        setError(err);
        statusRef.current?.reportFailure();
      } finally {
        inFlight = false;
        if (active) {
          setLoading(false);
          if (rerun) {
            rerun = false;
            run();
          } else {
            schedule();
          }
        }
      }
    }

    function schedule() {
      clearTimeout(timer);
      if (!document.hidden) timer = setTimeout(run, intervalMs);
    }

    function onVisibility() {
      if (document.hidden) clearTimeout(timer);
      else run();
    }

    runRef.current = run;
    run();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false;
      clearTimeout(timer);
      runRef.current = null;
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);

  // Manual refresh (e.g. after a mutation). If a poll is in flight, runs again right after it.
  const refresh = useCallback(() => runRef.current?.(), []);

  return { data, error, loading, lastUpdated, refresh };
}
