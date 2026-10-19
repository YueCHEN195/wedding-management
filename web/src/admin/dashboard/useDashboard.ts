import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
const MOTION_QUERY = '(prefers-reduced-motion: reduce)';
function subscribeMotion(notify: () => void) {
  const media = window.matchMedia(MOTION_QUERY);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
}
const reducedMotionSnapshot = () => window.matchMedia(MOTION_QUERY).matches;
export function useDashboard() {
  const summary = useQuery({ queryKey: ['stats', 'summary'], queryFn: api.stats.summary });
  const charts = useQuery({ queryKey: ['stats', 'charts'], queryFn: api.stats.charts });
  const reducedMotion = useSyncExternalStore(subscribeMotion, reducedMotionSnapshot, () => true);
  const refresh = () => {
    void summary.refetch();
    void charts.refetch();
  };
  return { summary, charts, s: summary.data, reducedMotion, refresh };
}
export type DashboardModel = ReturnType<typeof useDashboard>;
