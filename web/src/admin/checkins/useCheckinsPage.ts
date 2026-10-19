import { useCurrentUser } from '@/api/useCurrentUser';
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Form, message } from 'antd';
import { api, ApiError } from '@/api/client';
import type { CheckinDTO, CheckinStatus } from '@shared/types';
import type { RecordActionTarget } from '../components/RecordAction';
import { attendanceValues, type AttendanceValues } from '../components/AttendanceFields';
import type { AdminOutletContext } from '../AdminLayout';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { adminFeedback } from '../theme';
type CorrectionValues = AttendanceValues & { reason: string };
export function useCheckinsPage() {
  const qc = useQueryClient();
  const { registerNavigationGuard } = useOutletContext<AdminOutletContext>();
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<CheckinDTO | null>(null);
  const [form] = Form.useForm<CorrectionValues>();
  const correction = useMutation({
    mutationFn: (v: CorrectionValues) =>
      api.checkins.correctAttendance(editing!.id, {
        ...attendanceValues(v),
        reason: v.reason,
        expectedHeadcount: editing!.actualHeadcount,
        expectedChildrenCount: editing!.actualChildrenCount,
      }),
    onSuccess: () => {
      for (const key of ['checkins', 'stats', 'guest-detail', 'record-history', 'action-preview'])
        void qc.invalidateQueries({ queryKey: [key] });
      message.success({
        content: '人数已保存，原值与原因已留存',
        duration: adminFeedback.toastDuration,
      });
      setDirty(false);
      setEditing(null);
    },
  });
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

  const openEdit = (r: CheckinDTO) => {
    if (me.data?.role !== 'admin' || r.status !== 'confirmed') return;
    setDirty(false);
    correction.reset();
    setEditing(r);
    form.resetFields();
    form.setFieldsValue({
      actualHeadcountInput: r.actualHeadcount == null ? undefined : String(r.actualHeadcount),
      actualChildrenInput: r.actualChildrenCount == null ? '0' : String(r.actualChildrenCount),
    });
  };
  const canLeave = useUnsavedChanges({
    dirty: editing != null && dirty,
    busy: correction.isPending,
  });
  useEffect(() => registerNavigationGuard(canLeave), [registerNavigationGuard, canLeave]);
  const closeEditor = async () => {
    if (!(await canLeave())) return;
    setDirty(false);
    setEditing(null);
    correction.reset();
  };
  const submit = (values: CorrectionValues) => {
    if (editing?.status === 'confirmed' && me.data?.role === 'admin' && !correction.isPending)
      correction.mutate(values);
  };
  const conflict = correction.error instanceof ApiError && correction.error.status === 409;
  return {
    editing,
    closeEditor,
    dirty,
    setDirty,
    submit,
    conflict,
    form,
    correction,
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
    openEdit,
  };
}
export type CheckinsModel = ReturnType<typeof useCheckinsPage>;
