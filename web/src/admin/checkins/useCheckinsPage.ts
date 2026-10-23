import { useCurrentUser } from '@/api/useCurrentUser';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { CheckinStatus } from '@shared/types';
import type { RecordActionTarget } from '../components/RecordAction';
import { useAttendanceEditor } from './useAttendanceEditor';
export function useCheckinsPage() {
  const attendanceEditor = useAttendanceEditor();
  const [action, setAction] = useState<RecordActionTarget | null>(null);
  const [historyId, setHistoryId] = useState<number | null>(null);
  const me = useCurrentUser();
  const [params, setParams] = useState<{
    page: number;
    pageSize: number;
    status?: CheckinStatus;
    keyword?: string;
  }>({
    page: 1,
    pageSize: 10,
  });
  const list = useQuery({
    queryKey: ['checkins', params],
    queryFn: () => api.checkins.list(params),
  });
  const [searchDraft, setSearchDraft] = useState('');
  const changeFilters = (patch: Partial<typeof params>) =>
    setParams((current) => ({ ...current, ...patch, page: 1 }));
  const search = (keyword: string) => changeFilters({ keyword: keyword.trim() || undefined });
  const clearKeyword = () => {
    setSearchDraft('');
    changeFilters({ keyword: undefined });
  };
  const resetFilters = () => {
    setSearchDraft('');
    changeFilters({ keyword: undefined, status: undefined });
  };

  return {
    ...attendanceEditor,
    action,
    setAction,
    historyId,
    setHistoryId,
    me,
    params,
    setParams,
    searchDraft,
    setSearchDraft,
    search,
    clearKeyword,
    resetFilters,
    changeFilters,
    list,
  };
}
export type CheckinsModel = ReturnType<typeof useCheckinsPage>;
