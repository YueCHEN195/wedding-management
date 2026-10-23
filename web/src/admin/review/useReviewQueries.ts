import { useCurrentUser } from '@/api/useCurrentUser';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { CheckinDTO } from '@shared/types';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
export function useReviewQueries(
  confirming: CheckinDTO | null,
  manualOpen: boolean,
  manualName: string,
  nameComposing: boolean,
) {
  const qc = useQueryClient();
  const me = useCurrentUser();
  const stats = useQuery({
    queryKey: ['stats', 'summary'],
    queryFn: api.stats.summary,
    enabled: me.data?.role === 'admin',
  });
  const confirmCandidates = useQuery({
    queryKey: ['checkin-candidates', confirming?.guestName],
    queryFn: () => api.checkins.candidates(confirming!.guestName),
    enabled: confirming != null,
    staleTime: 0,
  });
  const { pending: manualNameDebouncing } = useDebouncedValue(
    manualOpen && !nameComposing ? manualName : '',
  );
  const manualNamePending = nameComposing || manualNameDebouncing;
  const manualCandidates = useQuery({
    queryKey: ['checkin-candidates', manualName],
    queryFn: () => api.checkins.candidates(manualName),
    enabled: manualOpen && manualName.length > 0 && !manualNamePending,
    staleTime: 0,
  });
  const pending = useQuery({
    queryKey: ['checkins', 'pending'],
    queryFn: api.checkins.pending,
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
  const candidateNamePending = manualOpen && manualNamePending;
  const candidateLookupPending = manualOpen
    ? manualNamePending || manualCandidates.isPending || manualCandidates.isFetching
    : confirmCandidates.isPending || confirmCandidates.isFetching;
  return {
    me,
    stats,
    pending,
    confirmCandidates,
    manualCandidates,
    manualNamePending,
    candidateNamePending,
    candidateLookupPending,
    invalidate,
  };
}
