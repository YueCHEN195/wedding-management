import { useEffect, useState } from 'react';
import { Form, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { api } from '@/api/client';
import type { AdminOutletContext } from '../AdminLayout';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
export function useCheckinReassignment() {
  const qc = useQueryClient();
  const { registerNavigationGuard } = useOutletContext<AdminOutletContext>();
  const [record, setRecord] = useState<{ id: number; name: string } | null>(null);
  const [keyword, setKeyword] = useState('');
  const [dirty, setDirty] = useState(false);
  const [form] = Form.useForm<{ guestId: number; reason: string }>();
  const guestId = Form.useWatch('guestId', form);
  const { pending: searching } = useDebouncedValue(keyword);
  const candidates = useQuery({
    queryKey: ['reassignment-candidates', keyword],
    queryFn: () => api.guests.workbench({ keyword, pageSize: 50 }),
    enabled: !!record && !!keyword.trim() && !searching,
  });
  const preview = useQuery({
    queryKey: ['reassignment-preview', record?.id, guestId],
    queryFn: () => api.checkins.reassignmentPreview(record!.id, guestId!),
    enabled: record != null && guestId != null,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const save = useMutation({
    mutationFn: (values: { guestId: number; reason: string }) => {
      if (!preview.data || preview.isFetching || preview.isError)
        throw new Error('请先核对最新影响范围');
      return api.checkins.reassign(record!.id, { ...values, token: preview.data.token });
    },
    onSuccess: () => {
      for (const key of [
        'checkins',
        'gifts',
        'stats',
        'guest-detail',
        'staff-guest-detail',
        'review-directory',
        'staff-guests',
        'guests',
        'checkin-candidates',
        'record-history',
        'action-preview',
        'gift-current',
        'reassignment-preview',
      ])
        void qc.invalidateQueries({ queryKey: [key] });
      setDirty(false);
      setRecord(null);
      message.success('签到及关联礼金已纠正，原关联与原因已留痕');
    },
  });
  const canLeave = useUnsavedChanges({ dirty: !!record && dirty, busy: save.isPending });
  useEffect(() => registerNavigationGuard(canLeave), [registerNavigationGuard, canLeave]);
  const open = (id: number, name: string) => {
    form.resetFields();
    save.reset();
    setDirty(false);
    setKeyword('');
    setRecord({ id, name });
  };
  const close = async () => {
    if (await canLeave()) {
      setDirty(false);
      setRecord(null);
    }
  };
  return {
    record,
    keyword,
    setKeyword,
    searching,
    candidates,
    preview,
    save,
    form,
    setDirty,
    open,
    close,
  };
}
export type CheckinReassignmentModel = ReturnType<typeof useCheckinReassignment>;
