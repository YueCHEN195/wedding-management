import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Form, Input, Modal, Row, Select, Space, Statistic, Table, Tabs, Tag, Typography, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { RecordAction, RecordHistory, type RecordActionTarget } from './components/RecordAction';
import { api, ApiError } from '@/api/client';
import type { GiftDTO, GiftMethod } from '@shared/types';
import { parseGiftYuan } from '@shared/numericInput';
import { MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from '@shared/constraints';
import { METHOD_LABEL, SIDE_LABEL, formatDateTime, yuan } from '@/lib/format';

export function GiftsPage() {
  const qc = useQueryClient();
  const [params, setParams] = useState<{ page: number; pageSize: number; method?: GiftMethod; keyword?: string; state?: 'voided' | 'all' }>({
    page: 1,
    pageSize: 10,
  });
  const [action, setAction] = useState<RecordActionTarget | null>(null);
  const [historyId, setHistoryId] = useState<number | null>(null);
  const [editing, setEditing] = useState<GiftDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const draftAmount = parseGiftYuan(Form.useWatch('amountYuan', form));
  const draftMethod = Form.useWatch('method', form) as GiftMethod | undefined;
  const draftNote = Form.useWatch('note', form) as string | undefined;
  const latest = useQuery({ queryKey: ['gift-current', editing?.id], queryFn: () => api.gifts.get(editing!.id), enabled: creating && !!editing && conflict, staleTime: 0, refetchOnWindowFocus: false });
  const clearSaveState = () => { setSaveError(null); setConflict(false); };
  const recheckDraft = () => {
    if (!editing || !latest.data || latest.data.voidedAt != null) return;
    const v = form.getFieldsValue();
    // 仅保留本次真正修改的字段，未修改的字段采用他人的最新值。
    form.setFieldsValue({
      amountYuan: parseGiftYuan(v.amountYuan) === editing.amount ? String(latest.data.amount / 100) : v.amountYuan,
      method: v.method === editing.method ? latest.data.method : v.method,
      note: (v.note?.trim() || null) === (editing.note?.trim() || null) ? latest.data.note : v.note,
    });
    setEditing(latest.data); clearSaveState();
    message.info('已保留你的修改并载入最新内容，请核对下方预览后重新保存');
  };
  const name = ((Form.useWatch('guestName', form) as string | undefined) ?? '').trim();
  const candidates = useQuery({ queryKey: ['checkin-candidates', name], queryFn: () => api.checkins.candidates(name), enabled: creating && !editing && !!name, staleTime: 0 });
  useEffect(() => { form.setFieldValue('guestId', undefined); }, [name, form]);

  const list = useQuery({ queryKey: ['gifts', params], queryFn: () => api.gifts.list(params) });
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const isAdmin = me.data?.role === 'admin';

  const save = useMutation({
    mutationFn: (v: { guestName: string; amountYuan: string; method: GiftMethod; note?: string; reason?: string; guestId?: number | 'none' }) => {
      const amount = parseGiftYuan(v.amountYuan);
      if (amount == null) throw new ApiError('VALIDATION', '金额须为0.01–100000元，最多两位小数', 400);
      const payload = {
        guestName: v.guestName.trim(),
        guestId: typeof v.guestId === 'number' ? v.guestId : undefined,
        amount,
        method: v.method,
        note: v.note,
      };
      if (!editing) return api.gifts.create(payload);
      const patch = {
        ...(payload.amount !== editing.amount ? { amount: payload.amount } : {}),
        ...(payload.method !== editing.method ? { method: payload.method } : {}),
        ...((payload.note?.trim() || null) !== (editing.note?.trim() || null) ? { note: payload.note?.trim() || null } : {}),
      };
      if (!Object.keys(patch).length) throw new ApiError('NO_CHANGES', '内容没有变化，无需重复保存', 400);
      return api.gifts.update(editing.id, { ...patch, expectedVersion: editing.version, reason: v.reason ?? '' });
    },
    onSuccess: () => {
      message.success(editing ? '已更正，修改前后值与原因已留存' : '已登记，操作记录已保留');
      clearSaveState();
      setEditing(null);
      setCreating(false);
      for (const key of ['gifts', 'stats', 'guest-detail', 'checkins', 'record-history', 'action-preview', 'gift-current']) qc.invalidateQueries({ queryKey: [key] });
    },
    onError: (e) => {
      setSaveError(e instanceof ApiError ? e.message : '保存失败，请重试；当前填写已保留');
      if (e instanceof ApiError && ['VERSION_CONFLICT', 'CONFLICT'].includes(e.code)) setConflict(true);
    },
  });

  const columns: ColumnsType<GiftDTO> = [
    { title: '姓名', dataIndex: 'guestName', width: 150, render: (v, r) => <>{v} <small>#{r.id}{r.guestId != null ? ` · 宾客#${r.guestId}` : ''}</small></> },
    { title: '状态', dataIndex: 'voidedAt', width: 90, render: (v) => <Tag color={v == null ? 'green' : 'default'}>{v == null ? '有效' : '已撤回（作废）'}</Tag> },
    { title: '金额（元）', dataIndex: 'amount', width: 120, render: (v: number) => yuan(v) },
    { title: '方式', dataIndex: 'method', width: 100, render: (v: GiftMethod) => <Tag>{METHOD_LABEL[v]}</Tag> },
    { title: '备注', dataIndex: 'note', ellipsis: true, render: (v) => v ?? '-' },
    { title: '撤回时间', dataIndex: 'voidedAt', width: 170, render: formatDateTime },
    { title: '登记时间', dataIndex: 'recordedAt', width: 170, render: formatDateTime },
  ];

  if (isAdmin) {
    columns.push({
      title: '操作',
      width: 120,
      render: (_, r) => (
        <Space size="small">
          {r.voidedAt == null && <a
            onClick={() => {
              clearSaveState();
              setEditing(r);
              setCreating(true);
              form.resetFields();
              form.setFieldsValue({ guestName: r.guestName, amountYuan: String(r.amount / 100), method: r.method, note: r.note });
            }}
          >
            编辑
          </a>}
          <a onClick={() => setAction({ entity: 'gift', id: r.id, action: r.voidedAt == null ? 'void' : 'restore' })}>{r.voidedAt == null ? '作废' : '恢复'}</a>
          <a onClick={() => setHistoryId(r.id)}>操作记录</a>
        </Space>
      ),
    });
  }

  return (
    <div>
      <Typography.Title level={4}>礼金管理</Typography.Title>
      {action && <RecordAction key={`${action.id}-${action.action}`} target={action} onClose={() => setAction(null)} />}
      {historyId != null && <RecordHistory entity="gift" id={historyId} onClose={() => setHistoryId(null)} />}
      {isAdmin && list.data?.summary && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}><Card><Statistic title="有效礼金（当前筛选，元）" value={yuan(list.data.summary.total)} /></Card></Col>
          <Col xs={12} md={6}><Card><Statistic title="有效笔数" value={list.data.summary.count} /></Card></Col>
          {list.data.summary.byMethod.map((m) => (
            <Col xs={12} md={6} key={m.method}>
              <Card><Statistic title={`${METHOD_LABEL[m.method]}（元）`} value={yuan(m.amount)} /></Card>
            </Col>
          ))}
        </Row>
      )}

      <Tabs activeKey={params.state ?? 'active'} items={[{ key: 'active', label: '有效礼金' }, { key: 'voided', label: '已撤回礼金' }, { key: 'all', label: '全部礼金' }]}
        onChange={(v) => setParams((p) => ({ page: 1, pageSize: p.pageSize, state: v === 'voided' ? 'voided' : v === 'all' ? 'all' : undefined }))} />
      <Alert type="info" showIcon style={{ marginBottom: 16 }} title={params.state === 'voided' ? '以下礼金已撤回（作废），保留原金额但不计入有效汇总。操作记录可查看原因和操作者；恢复后重新计入汇总。' : '礼金自愿，签到不要求赠送礼金。此处只登记实际收到的礼金；未登记礼金不代表欠款。'} />
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          key={`search-${params.state ?? 'active'}`}
          placeholder="姓名"
          allowClear
          style={{ width: 200 }}
          onSearch={(v) => setParams((p) => ({ ...p, keyword: v, page: 1 }))}
        />
        <Select
          value={params.method}
          placeholder="方式"
          allowClear
          style={{ width: 120 }}
          options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))}
          onChange={(v) => setParams((p) => ({ ...p, method: v, page: 1 }))}
        />
        {isAdmin && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              clearSaveState();
              setEditing(null);
              form.resetFields();
              setCreating(true);
            }}
          >
            新增礼金
          </Button>
        )}
      </Space>

      <Table
        locale={{ emptyText: list.isError ? '加载失败，请刷新重试' : params.state === 'voided' ? '暂无已撤回礼金' : '暂无符合条件的礼金' }}
        rowKey="id"
        columns={columns}
        dataSource={list.data?.items ?? []}
        loading={list.isLoading}
        scroll={{ x: 1000 }}
        pagination={{
          current: params.page,
          pageSize: params.pageSize,
          total: list.data?.total ?? 0,
          onChange: (page, pageSize) => setParams((p) => ({ ...p, page, pageSize })),
        }}
      />

      <Modal
        title={editing ? `更正礼金 · ${editing.guestName} #${editing.id}` : '新增礼金'}
        width={680}
        style={{ top: 24 }}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' } }}
        open={creating}
        onCancel={() => {
          if (save.isPending) return;
          setCreating(false);
          setEditing(null);
          clearSaveState();
        }}
        okText={editing ? '保存更正并留痕' : '登记礼金'}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        cancelButtonProps={{ disabled: save.isPending }}
        okButtonProps={{ disabled: save.isPending || conflict || !editing && !!name && (candidates.isFetching || candidates.isError) }}
        destroyOnClose
      >
        {saveError && <Alert type="error" showIcon style={{ marginBottom: 16 }} title="本次更改尚未保存" description={saveError} />}
        {conflict && <Alert type="warning" showIcon style={{ marginBottom: 16 }} title="请先核对最新账目，你的草稿已保留" description={<>
          {latest.isFetching ? <p>正在读取最新记录…</p> : latest.isError ? <p>无法读取最新记录，请重试。</p> : latest.data && <>
            <p>最新记录：¥{yuan(latest.data.amount)} · {METHOD_LABEL[latest.data.method]} · {latest.data.voidedAt == null ? '有效' : '已撤回，当前不能更正'}</p>
            <p style={{ overflowWrap: 'anywhere' }}>最新备注：{latest.data.note || '未填'}</p>
            {latest.data.voidedAt == null && <Button onClick={recheckDraft}>保留我的修改，载入最新记录核对</Button>}
          </>}
          <Button type="link" disabled={latest.isFetching} onClick={() => latest.refetch()}>重新读取最新记录</Button>
        </>} />}
        <Form form={form} disabled={save.isPending} layout="vertical" onFinish={(v) => { if (!save.isPending && !conflict && (editing || !name || !candidates.isFetching && !candidates.isError)) save.mutate(v); }} initialValues={{ method: 'cash' }}>
          <Form.Item name="guestName" label="姓名" rules={[{ required: true, whitespace: true, max: MAX_NAME_LENGTH, message: '请填写姓名（1–50字）' }]}>
            <Input disabled={!!editing} maxLength={MAX_NAME_LENGTH} />
          </Form.Item>
          {!editing && name && <>
            {candidates.isFetching && <Typography.Paragraph>正在核对当前宾客名单…</Typography.Paragraph>}
            {candidates.isError && <Alert type="error" title="无法核对宾客名单，请重试" action={<Button onClick={() => candidates.refetch()}>重试</Button>} />}
            {candidates.isSuccess && candidates.data.length > 0 && <Form.Item name="guestId" label="对应宾客" rules={[{ required: true, message: '请选择对应宾客，或明确选择单独记礼金' }]}>
              <Select placeholder="按编号、归属和分组核对" options={[
                ...candidates.data.map((g) => ({ value: g.id as number | 'none', label: `#${g.id} · ${g.name} · ${g.side ? SIDE_LABEL[g.side] : '归属未填'} · ${g.groupName || '未分组'} · ${g.checkedIn ? '已签到' : '未签到'}` })),
                { value: 'none' as const, label: '不关联当前宾客，单独记礼金' },
              ]} optionRender={(o) => <span style={{ whiteSpace: 'normal' }}>{o.label}</span>} />
            </Form.Item>}
            {candidates.isSuccess && candidates.data.length === 0 && <Typography.Paragraph type="secondary">未找到同名的当前宾客；此笔礼金将独立保存，不会自动建立宾客档案。</Typography.Paragraph>}
          </>}
          {editing && <Typography.Paragraph type="secondary">{editing.guestId != null ? `关联宾客 #${editing.guestId}` : '未关联宾客'}；编辑不会改变原关联。</Typography.Paragraph>}
          <Form.Item name="amountYuan" label="金额（元）" rules={[{ required: true, message: '请填写金额（0.01–100000元）' }, { validator: (_, v) =>
            parseGiftYuan(v) != null ? Promise.resolve() : Promise.reject(new Error('金额须为0.01–100000元，最多两位小数')) }]}>
            <Input inputMode="decimal" maxLength={12} placeholder="例如：600.00" />
          </Form.Item>
          <Form.Item name="method" label="方式" rules={[{ required: true }]}>
            <Select options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          {editing && <Alert showIcon type="info" style={{ marginBottom: 16 }} title="保存前核对" description={<>
            <p>原记录：¥{yuan(editing.amount)} · {METHOD_LABEL[editing.method]}</p>
            <p>本次修改：{draftAmount == null ? '请填写合法金额' : `¥${yuan(draftAmount)}`} · {draftMethod ? METHOD_LABEL[draftMethod] : '请选择方式'}</p>
            {(draftNote?.trim() || null) !== (editing.note?.trim() || null) && <p style={{ overflowWrap: 'anywhere' }}>备注：{editing.note || '未填'} → {draftNote?.trim() || '未填'}</p>}
            <span>保存后按新金额计入有效汇总，原金额、方式、备注及更正原因保留在操作记录中。</span>
          </>} />}
          <Form.Item name="note" label="备注" rules={[{ max: MAX_TEXT_LENGTH, message: '备注最多500字' }]} >
            <Input maxLength={MAX_TEXT_LENGTH} />
          </Form.Item>
          {editing && <Form.Item name="reason" label="更正原因" rules={[{ required: true, whitespace: true, max: 200, message: '请填写具体更正原因（最多200字）' }]}>
            <Input.TextArea maxLength={200} rows={2} placeholder="例如：现场重新核对红包，原金额录入有误" />
          </Form.Item>}
        </Form>
      </Modal>
    </div>
  );
}
