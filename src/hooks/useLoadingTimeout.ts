import { useEffect, useState } from 'react';

/**
 * Returns true once the loading state has been active for `ms` milliseconds.
 * Used to show a retry UI instead of an indefinite spinner.
 */
export function useLoadingTimeout(loading: boolean, ms = 5000) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }
    const t = setTimeout(() => setTimedOut(true), ms);
    return () => clearTimeout(t);
  }, [loading, ms]);

  return timedOut;
}
