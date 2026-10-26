import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Form, message } from 'antd';
import { useOutletContext } from 'react-router-dom';
import type { AdminOutletContext } from '../AdminLayout';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { api, ApiError } from '@/api/client';
import { createSubmissionKey } from '@/lib/submissionKey';
import type { GiftDTO, GiftMethod } from '@shared/types';
import { parseGiftYuan } from '@shared/numericInput';
export interface GiftFormValues {
  guestName: string;
  amountYuan: string;
  method: GiftMethod;
  note?: string;
  reason?: string;
  guestId?: number | 'none';
}
export function useGiftEditor() {
  const qc = useQueryClient();
  const { registerNavigationGuard } = useOutletContext<AdminOutletContext>();
  const [dirty, setDirty] = useState(false);
  const [nameComposing, setNameComposing] = useState(false);
  const [editing, setEditing] = useState<GiftDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [submissionKey, setSubmissionKey] = useState('');
  const [form] = Form.useForm<GiftFormValues>();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const latest = useQuery({
    queryKey: ['gift-current', editing?.id],
    queryFn: () => api.gifts.get(editing!.id),
    enabled: creating && !!editing && conflict,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const clearSaveState = () => {
    setSaveError(null);
    setConflict(false);
  };
  const recheckDraft = () => {
    if (!editing || !latest.data || latest.data.voidedAt != null) return;
    const v = form.getFieldsValue();
    // 仅保留本次真正修改的字段，未修改的字段采用他人的最新值。
    form.setFieldsValue({
      amountYuan:
        parseGiftYuan(v.amountYuan) === editing.amount
          ? String(latest.data.amount / 100)
          : v.amountYuan,
      method: v.method === editing.method ? latest.data.method : v.method,
      note:
        (v.note?.trim() || null) === (editing.note?.trim() || null)
          ? (latest.data.note ?? undefined)
          : v.note,
    });
    setEditing(latest.data);
    clearSaveState();
    message.info('已保留你的修改并载入最新内容，请核对下方预览后重新保存');
  };
  const name = ((Form.useWatch('guestName', form) as string | undefined) ?? '').trim();
  const { pending: nameDebouncing } = useDebouncedValue(
    creating && !editing && !nameComposing ? name : '',
  );
  const namePending = nameComposing || nameDebouncing;
  const candidates = useQuery({
    queryKey: ['checkin-candidates', name],
    queryFn: () => api.checkins.candidates(name),
    enabled: creating && !editing && !!name && !namePending,
    staleTime: 0,
  });
  const candidateLookupPending = namePending || candidates.isPending || candidates.isFetching;
  useEffect(() => {
    form.setFieldValue('guestId', undefined);
  }, [name, form]);

  const save = useMutation({
    mutationFn: (v: {
      guestName: string;
      amountYuan: string;
      method: GiftMethod;
      note?: string;
      reason?: string;
      guestId?: number | 'none';
    }) => {
      const amount = parseGiftYuan(v.amountYuan);
      if (amount == null)
        throw new ApiError('VALIDATION', '金额须为0.01–100000元，最多两位小数', 400);
      const payload = {
        guestName: v.guestName.trim(),
        guestId: typeof v.guestId === 'number' ? v.guestId : undefined,
        amount,
        method: v.method,
        note: v.note,
      };
      if (!editing) return api.gifts.create({ ...payload, submissionKey });
      const patch = {
        ...(payload.amount !== editing.amount ? { amount: payload.amount } : {}),
        ...(payload.method !== editing.method ? { method: payload.method } : {}),
        ...((payload.note?.trim() || null) !== (editing.note?.trim() || null)
          ? { note: payload.note?.trim() || null }
          : {}),
      };
      if (!Object.keys(patch).length)
        throw new ApiError('NO_CHANGES', '内容没有变化，无需重复保存', 400);
      return api.gifts.update(editing.id, {
        ...patch,
        expectedVersion: editing.version,
        reason: v.reason ?? '',
      });
    },
    onSuccess: () => {
      message.success(editing ? '已更正，修改前后值与原因已留存' : '已登记，操作记录已保留');
      clearSaveState();
      setDirty(false);
      setEditing(null);
      setCreating(false);
      for (const key of [
        'gifts',
        'stats',
        'guest-detail',
        'checkins',
        'record-history',
        'action-preview',
        'gift-current',
        'review-directory',
      ])
        void qc.invalidateQueries({ queryKey: [key] });
    },
    onError: (e) => {
      setSaveError(e instanceof ApiError ? e.message : '保存失败，请重试；当前填写已保留');
      if (e instanceof ApiError && ['VERSION_CONFLICT', 'CONFLICT'].includes(e.code))
        setConflict(true);
    },
  });

  const openEdit = (gift: GiftDTO) => {
    setNameComposing(false);
    setDirty(false);
    save.reset();
    clearSaveState();
    setEditing(gift);
    setCreating(true);
    form.resetFields();
    form.setFieldsValue({
      guestName: gift.guestName,
      amountYuan: String(gift.amount / 100),
      method: gift.method,
      note: gift.note ?? undefined,
    });
  };
  const openCreate = () => {
    setSubmissionKey(createSubmissionKey());
    setNameComposing(false);
    setDirty(false);
    save.reset();
    clearSaveState();
    setEditing(null);
    form.resetFields();
    setCreating(true);
  };
  const canLeave = useUnsavedChanges({
    dirty: creating && dirty,
    busy: save.isPending,
    content: '离开会丢弃本次礼金填写，确认离开吗？',
  });
  useEffect(() => registerNavigationGuard(canLeave), [registerNavigationGuard, canLeave]);
  const close = async () => {
    if (!(await canLeave())) return;
    setDirty(false);
    setCreating(false);
    setEditing(null);
    clearSaveState();
  };
  const submit = (v: GiftFormValues) => {
    if (
      !save.isPending &&
      !conflict &&
      (editing || (!!name && !candidateLookupPending && candidates.isSuccess))
    )
      save.mutate(v);
  };
  return {
    editing,
    creating,
    dirty,
    setDirty,
    form,
    saveError,
    conflict,
    latest,
    recheckDraft,
    name,
    candidates,
    namePending,
    candidateLookupPending,
    setNameComposing,
    save,
    openEdit,
    openCreate,
    close,
    submit,
  };
}
export type GiftEditorModel = ReturnType<typeof useGiftEditor>;
