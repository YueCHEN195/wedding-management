import { useCurrentUser } from '@/api/useCurrentUser';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { CheckinDTO } from '@shared/types';
export function useReviewQueries(
  confirming: CheckinDTO | null,
  manualOpen: boolean,
  manualName: string,
) {
  const qc = useQueryClient();
  const me = useCurrentUser();
  const stats = useQuery({
    queryKey: ['stats', 'summary'],
    queryFn: api.stats.summary,
    enabled: me.data?.role === 'admin',
    refetchInterval: 15000,
  });
  const confirmCandidates = useQuery({
    queryKey: ['checkin-candidates', confirming?.guestName],
    queryFn: () => api.checkins.candidates(confirming!.guestName),
    enabled: confirming != null,
    staleTime: 0,
  });
  const manualCandidates = useQuery({
    queryKey: ['checkin-candidates', manualName],
    queryFn: () => api.checkins.candidates(manualName),
    enabled: manualOpen && manualName.length > 0,
    staleTime: 0,
  });
  const pending = useQuery({
    queryKey: ['checkins', 'pending'],
    queryFn: api.checkins.pending,
    refetchInterval: 5000,
  });
  const invalidate = () => {
    for (const key of [
      'checkins',
      'checkin-candidates',
      'stats',
      'gifts',
      'guests',
      'guest-detail',
      'review-directory',
      'staff-guests',
    ])
      void qc.invalidateQueries({ queryKey: [key] });
  };
  return { me, stats, pending, confirmCandidates, manualCandidates, invalidate };
}
