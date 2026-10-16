import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Descriptions, Drawer, Empty, Form, Input, Select, Space, Tabs, Tag, Typography, message } from 'antd';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { adminFeedback } from '../theme';
import { ViewportTable } from './ViewportTable';
import type { ColumnsType } from 'antd/es/table';
import type { GuestDTO, ReviewGuestRow, ReviewGuestStatus, Side } from '@shared/types';
import { MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from '@shared/constraints';
import { api } from '@/api/client';
import { formatDateTime, SIDE_LABEL, yuan } from '@/lib/format';

const labels: Record<ReviewGuestStatus, string> = { pending: '◷ 待审核', confirmed: '✓ 已签到', unconfirmed: '— 未签到' };
export function ReviewDirectory({ admin, disabled, selectedId, onProcess, onNavigate }: {
  admin: boolean; disabled: boolean; selectedId?: number | null;
  onProcess: (row: ReviewGuestRow) => void; onNavigate: (path: string) => void;
}) {
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<ReviewGuestStatus>();
  const [side, setSide] = useState<Side>();
  const [page, setPage] = useState(1);
  const [advanced, setAdvanced] = useState(false);
  const [selected, setSelected] = useState<ReviewGuestRow | null>(null);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [form] = Form.useForm();
  const query = useQuery({ queryKey: ['review-directory', { keyword, status, side, page }],
    queryFn: () => api.guests.workbench({ keyword, status, side, page, pageSize: 10 }), refetchInterval: 15000 });
  const detail = useQuery({ queryKey: ['guest-detail', selected?.guestId], queryFn: () => api.guests.detail(selected!.guestId!), enabled: admin && selected?.guestId != null });
  const update = useMutation({ mutationFn: (v: Partial<GuestDTO>) => api.guests.update(selected!.guestId!, v), onSuccess: () => {
    for (const key of ['review-directory', 'guests', 'staff-guests', 'guest-detail', 'checkin-candidates', 'checkins']) qc.invalidateQueries({ queryKey: [key] });
    setEditing(false); setDirty(false);
    message.success({ content: '宾客档案已保存', duration: adminFeedback.toastDuration });
  } });
  const canLeave = useUnsavedChanges({ dirty, busy: update.isPending, title: '宾客修改尚未保存', content: '关闭将丢弃本次档案修改。', okText: '丢弃修改', cancelText: '继续编辑' });
  const close = async () => {
    if (!await canLeave()) return;
    setSelected(null); setEditing(false); setDirty(false); update.reset();
  };
  const columns: ColumnsType<ReviewGuestRow> = [
    { title: '姓名', width: 120, fixed: 'left', render: (_, r) => <Button type="link" onClick={() => setSelected(r)}>{r.name}</Button> },
    { title: '分组 / 归属', width: 145, render: (_, r) => r.guestId == null ? '未匹配档案' : [r.groupName, r.side && SIDE_LABEL[r.side]].filter(Boolean).join(' · ') || '—' },
    { title: '预计', dataIndex: 'expected', width: 64, align: 'right', render: (v) => v == null ? '—' : `${v}人` },
    { title: '实到', dataIndex: 'actual', width: 88, align: 'right', render: (v, r) => v == null ? r.status === 'confirmed' ? '待补记' : '—' : `${v}人` },
    { title: '签到状态', width: 102, render: (_, r) => <Tag variant="filled" color={r.status === 'confirmed' ? 'success' : r.status === 'pending' ? 'warning' : 'default'}>{labels[r.status]}</Tag> },
    ...(admin ? [{ title: '有效礼金', width: 110, align: 'right' as const, render: (_: unknown, r: ReviewGuestRow) => r.giftTotal == null ? '未登记' : `¥${yuan(r.giftTotal)}` }] : []),
    { title: '提交 / 签到', width: 145, render: (_, r) => r.time ? formatDateTime(r.time) : '—' },
    ...(admin ? [{ title: '备注', dataIndex: 'note', width: 130, ellipsis: true, render: (v: string | null) => v || '—' }] : []),
    { title: '操作', width: 100, fixed: 'right', render: (_, r) => <Button type="link" disabled={disabled} onClick={() => r.status === 'confirmed' ? setSelected(r) : onProcess(r)}>{r.status === 'confirmed' ? '查看记录' : '核对签到'}</Button> },
  ];
  return <section className="review-directory" aria-label="全部宾客查询">
    <Tabs activeKey={status ?? 'all'} onChange={(v) => { setStatus(v === 'all' ? undefined : v as ReviewGuestStatus); setPage(1); }} items={[
      { key: 'all', label: '全部宾客' }, { key: 'pending', label: '待审核' }, { key: 'confirmed', label: '已签到' }, { key: 'unconfirmed', label: '未签到' },
    ]} />
    <div className="review-filterbar">
      <Input.Search aria-label="搜索姓名或分组" placeholder="搜索姓名 / 分组" allowClear value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} />
      <Button type="text" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}>归属筛选 {advanced ? '−' : '+'}</Button>
      <Button type="text" onClick={() => { setKeyword(''); setStatus(undefined); setSide(undefined); setPage(1); }}>重置</Button>
      <span className="review-connection">{query.data ? `当前筛选 ${query.data.total} 条` : '正在读取名单'}</span>
    </div>
    {advanced && <div className="review-filterbar"><Select aria-label="归属方" allowClear placeholder="全部归属" value={side} onChange={(v) => { setSide(v); setPage(1); }} options={Object.entries(SIDE_LABEL).map(([value, label]) => ({ value, label }))} /></div>}
    {query.isError && <Alert type="error" showIcon title={query.data ? '名单刷新失败，以下为上次数据' : '宾客名单加载失败'} action={<Button onClick={() => query.refetch()}>重试</Button>} />}
    <ViewportTable<ReviewGuestRow> rowKey="key" size="small" columns={columns} dataSource={query.data?.items ?? []} loading={query.isPending}
      rowClassName={(r) => r.pendingId != null && r.pendingId === selectedId ? 'review-selected-row' : ''}
      empty={query.isError ? '连接失败，不能判断名单是否为空' : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={keyword || status || side ? '没有符合条件的宾客' : '还没有宾客档案或待审核提交'} />}
      scrollX={admin ? 1104 : 864} pagination={{ current: page, pageSize: 10, total: query.data?.total, showSizeChanger: false, onChange: setPage }} />
    <p className="review-connection">预计人数来自最新出席回执；实到包含儿童。未匹配提交独立展示，核对后再关联档案。</p>
    <Drawer title={`${selected?.name ?? '宾客详情'}${selected?.guestId ? ` · #${selected.guestId}` : ' · 未匹配档案'}`} size={480} open={selected != null} onClose={close}
      footer={<Space><Button onClick={close} disabled={update.isPending}>关闭</Button>{editing ? <Button type="primary" loading={update.isPending} onClick={() => form.submit()}>保存修改</Button>
        : admin && selected?.guestId != null && <Button disabled={!detail.data || detail.isFetching || detail.isError || disabled || !!detail.data.guest.archivedAt} onClick={() => { form.setFieldsValue(detail.data!.guest); setEditing(true); update.reset(); }}>编辑档案</Button>}</Space>}>
      {detail.isError && admin && <Alert type="error" title="档案加载失败" action={<Button onClick={() => detail.refetch()}>重试</Button>} />}
      {update.isError && <Alert type="error" showIcon title="修改未保存，输入已保留" description={update.error.message} />}
      {editing ? <Form form={form} layout="vertical" disabled={update.isPending} onValuesChange={() => setDirty(true)} onFinish={(v) => update.mutate({ ...v, side: v.side ?? null })}>
        <Form.Item name="name" label="姓名" rules={[{ required: true, whitespace: true, max: MAX_NAME_LENGTH }]}><Input maxLength={MAX_NAME_LENGTH} /></Form.Item>
        <Form.Item name="groupName" label="分组" rules={[{ max: 50 }]}><Input maxLength={50} /></Form.Item>
        <Form.Item name="side" label="归属方"><Select allowClear options={Object.entries(SIDE_LABEL).map(([value, label]) => ({ value, label }))} /></Form.Item>
        <Form.Item name="note" label="备注" rules={[{ max: MAX_TEXT_LENGTH }]}><Input.TextArea rows={4} maxLength={MAX_TEXT_LENGTH} /></Form.Item>
      </Form> : selected && <>
        <Descriptions column={1} items={[
          { key: 'group', label: '分组', children: detail.data?.guest.groupName ?? selected.groupName ?? '未填写' },
          { key: 'status', label: '签到', children: labels[selected.status] },
          { key: 'expected', label: '预计人数', children: selected.expected == null ? '未确认出席' : `${selected.expected}人` },
          { key: 'actual', label: '实际人数', children: selected.actual == null ? '未记录' : `${selected.actual}人（含儿童）` },
          { key: 'actor', label: '确认操作人', children: '未记录' },
          ...(admin ? [{ key: 'gift', label: '有效礼金', children: selected.giftTotal == null ? '未登记' : `¥${yuan(selected.giftTotal)}` }, { key: 'note', label: '备注', children: detail.data?.guest.note ?? selected.note ?? '—' }] : []),
        ]} />
        {selected.status === 'confirmed' ? <><Typography.Paragraph type="secondary">已签到，无需重复确认。更正到场人数或礼金时，请在对应记录中填写更正原因。</Typography.Paragraph><Space wrap><Button onClick={() => onNavigate('/admin/checkins')}>签到记录 / 人数更正</Button><Button onClick={() => onNavigate('/admin/gifts')}>礼金登记 / 更正</Button></Space></>
          : <Button type="primary" disabled={disabled} onClick={() => { onProcess(selected); setSelected(null); }}>进入核对</Button>}
      </>}
    </Drawer>
  </section>;
}
