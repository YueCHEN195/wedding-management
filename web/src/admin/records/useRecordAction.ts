import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Form, message } from 'antd';
import { api, ApiError } from '@/api/client';
import type { LifecycleEntity } from '@shared/types';
import type { RecordActionTarget } from './types';
import { adminFeedback } from '../theme';
export function useRecordAction(target: RecordActionTarget, onClose: () => void) {
  const qc = useQueryClient();
  const [form] = Form.useForm<{ reason: string }>();
  const preview = useQuery({
    queryKey: ['action-preview', target.entity, target.id, target.action],
    queryFn: () => api.lifecycle.preview(target.entity, target.id, target.action),
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const submit = useMutation({
    mutationFn: (v: { reason: string }) =>
      api.lifecycle.apply(target.entity, target.id, {
        ...v,
        action: target.action,
        token: preview.data!.token,
      }),
    onSuccess: () => {
      for (const key of [
        'guests',
        'guest-groups',
        'guest-detail',
        'rsvps',
        'checkins',
        'checkin-candidates',
        'gifts',
        'stats',
        'record-history',
        'action-preview',
        'review-directory',
        'staff-guests',
        'staff-guest-detail',
      ]) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
      message.success({
        content: '操作已保存，原记录和操作历史已保留',
        duration: adminFeedback.toastDuration,
      });
      onClose();
    },
    onError: (e) => {
      message.error(e instanceof ApiError ? e.message : '操作失败，请重试');
      void preview.refetch();
    },
  });
  return { form, preview, submit };
}
export type RecordActionModel = ReturnType<typeof useRecordAction>;
export function useRecordHistory(entity: LifecycleEntity, id: number) {
  const query = useQuery({
    queryKey: ['record-history', entity, id],
    queryFn: () => api.lifecycle.history(entity, id),
    retry: false,
  });
  return query;
}
