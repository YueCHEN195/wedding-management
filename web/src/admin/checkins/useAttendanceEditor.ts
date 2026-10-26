import { useCurrentUser } from '@/api/useCurrentUser';
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Form, message } from 'antd';
import { api, ApiError } from '@/api/client';
import type { CheckinDTO } from '@shared/types';
import { attendanceValues, type AttendanceValues } from '../components/AttendanceFields';
import type { AdminOutletContext } from '../AdminLayout';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { adminFeedback } from '../theme';
type AttendanceRecord = Pick<
  CheckinDTO,
  | 'id'
  | 'guestId'
  | 'guestName'
  | 'status'
  | 'confirmedAt'
  | 'actualHeadcount'
  | 'actualChildrenCount'
>;
type CorrectionValues = AttendanceValues & { reason: string };
export function useAttendanceEditor() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const { registerNavigationGuard } = useOutletContext<AdminOutletContext>();
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
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
      for (const key of [
        'checkins',
        'stats',
        'guest-detail',
        'staff-guest-detail',
        'record-history',
        'action-preview',
        'review-directory',
        'guests',
        'staff-guests',
      ])
        void qc.invalidateQueries({ queryKey: [key] });
      message.success({
        content: '人数已保存，原值与原因已留存',
        duration: adminFeedback.toastDuration,
      });
      setDirty(false);
      setEditing(null);
    },
  });
  const openEdit = (r: AttendanceRecord) => {
    if (!me.data || r.status !== 'confirmed') return;
    setDirty(false);
    correction.reset();
    setEditing(r);
    form.resetFields();
    form.setFieldsValue({
      actualHeadcountInput: r.actualHeadcount == null ? undefined : String(r.actualHeadcount),
      actualChildrenInput:
        r.actualChildrenCount == null ? undefined : String(r.actualChildrenCount),
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
    if (editing?.status === 'confirmed' && !!me.data && !correction.isPending)
      correction.mutate(values);
  };
  const conflict = correction.error instanceof ApiError && correction.error.status === 409;
  return { editing, closeEditor, dirty, setDirty, submit, conflict, form, correction, openEdit };
}
export type AttendanceEditorModel = ReturnType<typeof useAttendanceEditor>;
