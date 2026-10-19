import { useCurrentUser } from '@/api/useCurrentUser';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Form, message } from 'antd';
import { api, ApiError } from '@/api/client';
import type { CheckinDTO, CheckinStatus } from '@shared/types';
import type { RecordActionTarget } from '../components/RecordAction';
import { attendanceValues, type AttendanceValues } from '../components/AttendanceFields';
export function useCheckinsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CheckinDTO | null>(null);
  const [form] = Form.useForm();
  const correction = useMutation({
    mutationFn: (v: AttendanceValues & { reason: string }) =>
      api.checkins.correctAttendance(editing!.id, {
        ...attendanceValues(v),
        reason: v.reason,
        expectedHeadcount: editing!.actualHeadcount,
        expectedChildrenCount: editing!.actualChildrenCount,
      }),
    onSuccess: () => {
      for (const key of ['checkins', 'stats', 'guest-detail', 'record-history', 'action-preview'])
        void qc.invalidateQueries({ queryKey: [key] });
      message.success('人数已保存，原值与原因已留存');
      setEditing(null);
    },
    onError: (e) =>
      message.error(
        e instanceof ApiError
          ? `${e.message}${e.status === 409 ? '；请关闭弹窗并刷新后重新打开' : ''}`
          : '保存失败，请重试',
      ),
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

  const openEdit = (r: CheckinDTO) => {
    setEditing(r);
    form.resetFields();
    form.setFieldsValue({
      actualHeadcountInput: r.actualHeadcount == null ? undefined : String(r.actualHeadcount),
      actualChildrenInput: r.actualChildrenCount == null ? '0' : String(r.actualChildrenCount),
    });
  };
  return {
    editing,
    setEditing,
    form,
    correction,
    action,
    setAction,
    historyId,
    setHistoryId,
    me,
    params,
    setParams,
    list,
    openEdit,
  };
}
export type CheckinsModel = ReturnType<typeof useCheckinsPage>;
