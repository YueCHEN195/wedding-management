import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Form, message } from 'antd';
import { api } from '@/api/client';
import { useOutletContext } from 'react-router-dom';
import type { AdminOutletContext } from '../AdminLayout';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { adminFeedback } from '../theme';
import type { Attending, RsvpDTO } from '@shared/types';
import { parseHeadcount } from '@shared/numericInput';
export interface RsvpFormValues {
  attending: Attending;
  headcount: string;
  childrenCount: string;
  message?: string | null;
}
export function useRsvpsPage() {
  const qc = useQueryClient();
  const { registerNavigationGuard } = useOutletContext<AdminOutletContext>();
  const [params, setParams] = useState<{
    page: number;
    pageSize: number;
    keyword?: string;
    attending?: Attending;
  }>({
    page: 1,
    pageSize: 10,
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
    changeFilters({ keyword: undefined, attending: undefined });
  };
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<RsvpDTO | null>(null);
  const [form] = Form.useForm<RsvpFormValues>();
  const attending = Form.useWatch('attending', form);

  const list = useQuery({ queryKey: ['rsvps', params], queryFn: () => api.rsvps.list(params) });
  const s = list.data?.summary;

  const save = useMutation({
    mutationFn: (values: RsvpFormValues) =>
      api.rsvps.update(editing!.id, {
        ...values,
        headcount: parseHeadcount(values.headcount)!,
        childrenCount: parseHeadcount(values.childrenCount)!,
      }),
    onSuccess: () => {
      message.success({
        content: '回执已保存，现场实到人数不受影响',
        duration: adminFeedback.toastDuration,
      });
      setDirty(false);
      setEditing(null);
      for (const key of ['rsvps', 'guests', 'guest-detail', 'checkin-candidates', 'stats']) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });

  const openEdit = (r: RsvpDTO) => {
    if (r.guestArchived) return;
    setDirty(false);
    save.reset();
    setEditing(r);
    form.resetFields();
    form.setFieldsValue({
      ...r,
      headcount: String(r.attending === 'yes' ? r.headcount : 0),
      childrenCount: String(r.attending === 'yes' ? r.childrenCount : 0),
    });
  };
  const canLeave = useUnsavedChanges({
    dirty: editing != null && dirty,
    busy: save.isPending,
    content: '离开会丢弃本次回执修改，确认离开吗？',
  });
  useEffect(() => registerNavigationGuard(canLeave), [registerNavigationGuard, canLeave]);
  const closeEditor = async () => {
    if (!(await canLeave())) return;
    setDirty(false);
    setEditing(null);
    save.reset();
  };
  const submit = (values: RsvpFormValues) => {
    if (editing && !editing.guestArchived && !save.isPending) save.mutate(values);
  };
  return {
    params,
    setParams,
    searchDraft,
    setSearchDraft,
    changeFilters,
    search,
    clearKeyword,
    resetFilters,
    editing,
    dirty,
    setDirty,
    closeEditor,
    form,
    attending,
    list,
    s,
    save,
    openEdit,
    submit,
  };
}
export type RsvpsModel = ReturnType<typeof useRsvpsPage>;
