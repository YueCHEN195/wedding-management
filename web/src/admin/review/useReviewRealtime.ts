import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
const FALLBACK_REFRESH_MS = 15000;
export function useReviewRealtime() {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const refresh = () => {
      for (const key of [
        'checkins',
        'review-directory',
        'stats',
        'guest-detail',
        'checkin-candidates',
        'staff-guests',
        'staff-guest-detail',
      ])
        void qc.invalidateQueries({ queryKey: [key] });
    };
    const source = new EventSource('/api/events', { withCredentials: true });
    let fallback: ReturnType<typeof setInterval> | undefined;
    const ready = () => {
      setConnected(true);
      clearInterval(fallback);
      fallback = undefined;
      refresh(); // Catch up any writes missed while disconnected.
    };
    const retry = () => {
      setConnected(false);
      fallback ??= setInterval(refresh, FALLBACK_REFRESH_MS);
    };
    source.addEventListener('ready', ready);
    source.addEventListener('change', refresh);
    source.onerror = retry;
    // Covers an initial connection that never completes as well as later failures.
    fallback = setInterval(refresh, FALLBACK_REFRESH_MS);
    return () => {
      source.close();
      clearInterval(fallback);
    };
  }, [qc]);
  return connected;
}
