import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { AdminOutletContext } from '../AdminLayout';
import { useGiftEditor } from '../gifts/useGiftEditor';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Form, message } from 'antd';
import type { GuestDTO, ReviewGuestRow, ReviewGuestStatus, Side } from '@shared/types';
import { api, ApiError } from '@/api/client';
import { useGuestDraft } from '../guests/useGuestDraft';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { adminFeedback } from '../theme';
export interface ReviewDirectoryProps {
  admin: boolean;
  disabled: boolean;
  selectedId?: number | null;
  onProcess: (row: ReviewGuestRow) => void;
  onNavigate: (path: string) => void;
}
export function useReviewDirectory(admin: boolean) {
  const qc = useQueryClient();
  const { registerNavigationGuard } = useOutletContext<AdminOutletContext>();
  const giftEditor = useGiftEditor();
  const [keyword, setKeyword] = useState('');
  const { pending: keywordDebouncing } = useDebouncedValue(keyword);
  const searchPending = !!keyword && keywordDebouncing;
  const [status, setStatus] = useState<ReviewGuestStatus>();
  const [side, setSide] = useState<Side>();
  const [page, setPage] = useState(1);
  const [advanced, setAdvanced] = useState(false);
  const [selected, setSelected] = useState<ReviewGuestRow | null>(null);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [form] = Form.useForm<Partial<GuestDTO>>();
  const query = useQuery({
    queryKey: ['review-directory', { keyword, status, side, page }],
    queryFn: () => api.guests.workbench({ keyword, status, side, page, pageSize: 10 }),
    enabled: !searchPending,
    refetchInterval: 15000,
  });
  const detail = useQuery({
    queryKey: ['guest-detail', selected?.guestId],
    queryFn: () => api.guests.detail(selected!.guestId!),
    enabled: admin && selected?.guestId != null,
  });
  const { baseGuest, setBaseGuest, rechecking, recheck } = useGuestDraft(form, detail);
  const update = useMutation({
    mutationFn: (v: Partial<GuestDTO>) =>
      api.guests.update(selected!.guestId!, v, baseGuest!.updatedAt),
    onSuccess: () => {
      for (const key of [
        'review-directory',
        'guests',
        'staff-guests',
        'guest-detail',
        'checkin-candidates',
        'checkins',
      ])
        void qc.invalidateQueries({ queryKey: [key] });
      setEditing(false);
      setDirty(false);
      message.success({ content: '宾客档案已保存', duration: adminFeedback.toastDuration });
    },
  });
  const conflict =
    update.error instanceof ApiError &&
    ['VERSION_CONFLICT', 'CONFLICT'].includes(update.error.code);
  const recheckDraft = async () => {
    if (await recheck()) update.reset();
  };
  const canLeave = useUnsavedChanges({
    dirty,
    busy: update.isPending || rechecking,
    title: '宾客修改尚未保存',
    content: '关闭将丢弃本次档案修改。',
    okText: '丢弃修改',
    cancelText: '继续编辑',
  });
  useEffect(() => registerNavigationGuard(canLeave), [registerNavigationGuard, canLeave]);
  const close = async () => {
    if (!(await canLeave())) return;
    setSelected(null);
    setEditing(false);
    setDirty(false);
    update.reset();
  };
  const openEdit = () => {
    setBaseGuest(detail.data!.guest);
    form.setFieldsValue(detail.data!.guest);
    setEditing(true);
    update.reset();
  };
  return {
    conflict,
    rechecking,
    recheckDraft,
    giftEditor,
    keyword,
    searchPending,
    setKeyword,
    status,
    setStatus,
    side,
    setSide,
    page,
    setPage,
    advanced,
    setAdvanced,
    selected,
    setSelected,
    editing,
    setDirty,
    form,
    query,
    detail,
    update,
    close,
    openEdit,
  };
}
export type ReviewDirectoryModel = ReturnType<typeof useReviewDirectory>;
