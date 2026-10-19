import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Form, message } from 'antd';
import { api, ApiError } from '@/api/client';
import type { Attending, RsvpDTO } from '@shared/types';
import { parseHeadcount } from '@shared/numericInput';
export function useRsvpsPage() {
  const qc = useQueryClient();
  const [params, setParams] = useState<{
    page: number;
    pageSize: number;
    keyword?: string;
    attending?: Attending;
  }>({
    page: 1,
    pageSize: 10,
  });
  const [editing, setEditing] = useState<RsvpDTO | null>(null);
  const [form] = Form.useForm();
  const attending = Form.useWatch('attending', form);

  const list = useQuery({ queryKey: ['rsvps', params], queryFn: () => api.rsvps.list(params) });
  const s = list.data?.summary;

  const save = useMutation({
    mutationFn: (values: {
      attending: Attending;
      headcount: string;
      childrenCount: string;
      message?: string;
    }) =>
      api.rsvps.update(editing!.id, {
        ...values,
        headcount: parseHeadcount(values.headcount)!,
        childrenCount: parseHeadcount(values.childrenCount)!,
      }),
    onSuccess: () => {
      message.success('已保存');
      setEditing(null);
      for (const key of ['rsvps', 'guests', 'guest-detail', 'checkin-candidates', 'stats']) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败'),
  });

  const openEdit = (r: RsvpDTO) => {
    setEditing(r);
    form.resetFields();
    form.setFieldsValue({
      ...r,
      headcount: String(r.attending === 'yes' ? r.headcount : 0),
      childrenCount: String(r.attending === 'yes' ? r.childrenCount : 0),
    });
  };
  return { params, setParams, editing, setEditing, form, attending, list, s, save, openEdit };
}
export type RsvpsModel = ReturnType<typeof useRsvpsPage>;
