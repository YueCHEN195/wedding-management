import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Form, message } from 'antd';
import { useOutletContext } from 'react-router-dom';
import type { GuestDTO } from '@shared/types';
import type { AdminOutletContext } from '../AdminLayout';
import type { RecordActionTarget } from '../components/RecordAction';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { adminFeedback } from '../theme';
import { api, ApiError, type GuestListParams } from '@/api/client';
import { useGuestDraft } from './useGuestDraft';

export function useGuestManagement() {
  const qc = useQueryClient();
  const { registerNavigationGuard } = useOutletContext<AdminOutletContext>();
  const [params, setParams] = useState<GuestListParams>({ page: 1, pageSize: 10 });
  const [action, setAction] = useState<RecordActionTarget | null>(null);
  const [historyId, setHistoryId] = useState<number | null>(null);
  const [mode, setMode] = useState<'create' | 'view' | 'edit' | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [media, setMedia] = useState<{ guest: GuestDTO; type: 'qr' | 'poster' } | null>(null);
  const editorEpoch = useRef(0);
  const importLock = useRef(false);
  const [form] = Form.useForm<Partial<GuestDTO>>();
  const list = useQuery({ queryKey: ['guests', params], queryFn: () => api.guests.list(params) });
  const groups = useQuery({ queryKey: ['guest-groups'], queryFn: api.guests.groups });
  const detail = useQuery({
    queryKey: ['guest-detail', selectedId],
    queryFn: () => api.guests.detail(selectedId!),
    enabled: selectedId != null && mode != null,
  });
  const { baseGuest, setBaseGuest, rechecking, recheck } = useGuestDraft(form, detail);
  const guest = detail.data?.guest;
  const editing = mode === 'create' || mode === 'edit';

  const invalidate = () => {
    for (const key of [
      'guests',
      'guest-groups',
      'guest-detail',
      'rsvps',
      'checkins',
      'checkin-candidates',
      'gifts',
      'stats',
      'review-directory',
      'staff-guests',
      'staff-guest-detail',
    ])
      void qc.invalidateQueries({ queryKey: [key] });
  };
  const openView = (id: number) => {
    editorEpoch.current++;
    setSelectedId(id);
    setMode('view');
    setDirty(false);
    setInitializing(false);
  };
  const save = useMutation({
    mutationFn: (values: Partial<GuestDTO>) =>
      mode === 'edit'
        ? api.guests.update(selectedId!, values, baseGuest!.updatedAt)
        : api.guests.create(values),
    onSuccess: (savedGuest) => {
      const created = mode === 'create';
      setDirty(false);
      if (created) {
        setMode(null);
        setSelectedId(null);
      } else setMode('view');
      invalidate();
      message.success({
        duration: adminFeedback.toastDuration,
        content: `${created ? '已新增' : '已保存'} ${savedGuest.name}`,
      });
    },
  });
  const conflict =
    save.error instanceof ApiError && ['VERSION_CONFLICT', 'CONFLICT'].includes(save.error.code);
  const recheckDraft = async () => {
    if (await recheck()) save.reset();
  };
  const canLeave = useUnsavedChanges({ dirty, busy: save.isPending || rechecking });
  useEffect(() => registerNavigationGuard(canLeave), [registerNavigationGuard, canLeave]);
  const closeDrawer = async () => {
    if (!(await canLeave())) return;
    editorEpoch.current++;
    setMode(null);
    setSelectedId(null);
    setDirty(false);
    setInitializing(false);
    save.reset();
  };
  const openCreate = () => {
    editorEpoch.current++;
    setSelectedId(null);
    setMode('create');
    setDirty(false);
    setInitializing(false);
    form.resetFields();
    save.reset();
  };
  const openEdit = async (id: number) => {
    const epoch = ++editorEpoch.current;
    setSelectedId(id);
    setMode('edit');
    setDirty(false);
    setInitializing(true);
    form.resetFields();
    save.reset();
    try {
      const latest = await qc.fetchQuery({
        queryKey: ['guest-detail', id],
        queryFn: () => api.guests.detail(id),
        staleTime: 0,
      });
      if (editorEpoch.current !== epoch) return;
      if (latest.guest.archivedAt != null) {
        setMode('view');
        return;
      }
      const { name, salutation, phone, groupName, side, note } = latest.guest;
      setBaseGuest(latest.guest);
      form.setFieldsValue({ name, salutation, phone, groupName, side, note });
    } catch {
      /* Query owns the retryable error; no stale row snapshot is edited. */
    } finally {
      if (editorEpoch.current === epoch) setInitializing(false);
    }
  };
  const markSent = useMutation({
    mutationFn: api.guests.markSent,
    onSuccess: () => {
      message.success({ content: '已记录发送', duration: adminFeedback.toastDuration });
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : '标记失败，请重试'),
  });
  const changeFilters = (patch: Partial<GuestListParams>) =>
    setParams((current) => ({ ...current, ...patch, page: 1 }));
  const filtered = !!(params.keyword || params.status || params.groupName || params.side);
  const readyToEdit =
    !rechecking &&
    !conflict &&
    (mode === 'create' || (!!guest && !guest.archivedAt && !detail.isError && !initializing));

  const importGuests = async (file: File) => {
    if (importLock.current) return null;
    importLock.current = true;
    setImporting(true);
    setImportError(null);
    try {
      const result = await api.guests.import(file);
      if (!result.failed.length)
        message.success({
          content: `已导入 ${result.created} 位宾客`,
          duration: adminFeedback.toastDuration,
        });
      invalidate();
      return result;
    } catch (e) {
      setImportError(
        `${e instanceof ApiError ? e.message : '导入失败'}。请先核对名单，再决定是否重新导入。`,
      );
      return null;
    } finally {
      importLock.current = false;
      setImporting(false);
    }
  };
  return {
    conflict,
    rechecking,
    recheckDraft,
    params,
    setParams,
    action,
    setAction,
    historyId,
    setHistoryId,
    mode,
    selectedId,
    dirty,
    initializing,
    importing,
    importError,
    setImportError,
    media,
    setMedia,
    form,
    list,
    groups,
    detail,
    guest,
    editing,
    save,
    closeDrawer,
    openCreate,
    openEdit,
    openView,
    markSent,
    changeFilters,
    filtered,
    readyToEdit,
    setDirty,
    importGuests,
  };
}
export type GuestManagementModel = ReturnType<typeof useGuestManagement>;
