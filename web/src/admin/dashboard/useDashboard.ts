import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
export function useDashboard() {
  const summary = useQuery({ queryKey: ['stats', 'summary'], queryFn: api.stats.summary });
  const charts = useQuery({ queryKey: ['stats', 'charts'], queryFn: api.stats.charts });
  const s = summary.data;

  return { summary, charts, s };
}
export type DashboardModel = ReturnType<typeof useDashboard>;
