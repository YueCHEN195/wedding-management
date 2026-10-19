import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type GuestListParams } from '@/api/client';
export function useStaffGuests() {
  const [params, setParams] = useState<GuestListParams>({ page: 1, pageSize: 10 });
  const [detailId, setDetailId] = useState<number | null>(null);
  const list = useQuery({
    queryKey: ['staff-guests', params],
    queryFn: () => api.guests.staffList(params),
    refetchInterval: 15000,
  });
  const detail = useQuery({
    queryKey: ['staff-guest-detail', detailId],
    queryFn: () => api.guests.staffDetail(detailId!),
    enabled: detailId != null,
  });
  return { params, setParams, detailId, setDetailId, list, detail };
}
export type StaffGuestsModel = ReturnType<typeof useStaffGuests>;
