import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Col, Form, Input, InputNumber, Modal, Row, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { RecordAction, RecordHistory, type RecordActionTarget } from './components/RecordAction';
import { api, ApiError } from '@/api/client';
import type { GiftDTO, GiftMethod } from '@shared/types';
import { METHOD_LABEL, formatDateTime, yuan } from '@/lib/format';

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

  const list = useQuery({ queryKey: ['gifts', params], queryFn: () => api.gifts.list(params) });
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const isAdmin = me.data?.role === 'admin';

  const save = useMutation({
    mutationFn: (v: { guestName: string; amountYuan: number; method: GiftMethod; note?: string }) => {
      const payload = {
        guestName: v.guestName,
        amount: Math.round(v.amountYuan * 100),
        method: v.method,
        note: v.note,
      };
      return editing ? api.gifts.update(editing.id, { amount: payload.amount, method: payload.method, note: payload.note }) : api.gifts.create(payload);
    },
    onSuccess: () => {
      message.success('已保存');
      setEditing(null);
      setCreating(false);
      qc.invalidateQueries({ queryKey: ['gifts'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败'),
  });

  const columns: ColumnsType<GiftDTO> = [
    { title: '姓名', dataIndex: 'guestName', width: 150, render: (v, r) => <>{v} <small>#{r.id}{r.guestId != null ? ` · 宾客#${r.guestId}` : ''}</small></> },
    { title: '状态', dataIndex: 'voidedAt', width: 90, render: (v) => <Tag color={v == null ? 'green' : 'default'}>{v == null ? '有效' : '已作废'}</Tag> },
    { title: '金额（元）', dataIndex: 'amount', width: 120, render: (v: number) => yuan(v) },
    { title: '方式', dataIndex: 'method', width: 100, render: (v: GiftMethod) => <Tag>{METHOD_LABEL[v]}</Tag> },
    { title: '备注', dataIndex: 'note', ellipsis: true, render: (v) => v ?? '-' },
    { title: '时间', dataIndex: 'recordedAt', width: 170, render: formatDateTime },
  ];

  if (isAdmin) {
    columns.push({
      title: '操作',
      width: 120,
      render: (_, r) => (
        <Space size="small">
          {r.voidedAt == null && <a
            onClick={() => {
              setEditing(r);
              setCreating(true);
              form.setFieldsValue({ guestName: r.guestName, amountYuan: r.amount / 100, method: r.method, note: r.note });
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

      <Space style={{ marginBottom: 16 }} wrap>
        <Select value={params.state ?? 'active'} style={{ width: 130 }} options={[{ value: 'active', label: '有效礼金' }, { value: 'voided', label: '已作废礼金' }, { value: 'all', label: '全部礼金' }]} onChange={(v) => setParams((p) => ({ ...p, state: v === 'voided' ? 'voided' : v === 'all' ? 'all' : undefined, page: 1 }))} />
        <Input.Search
          placeholder="姓名"
          allowClear
          style={{ width: 200 }}
          onSearch={(v) => setParams((p) => ({ ...p, keyword: v, page: 1 }))}
        />
        <Select
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
        rowKey="id"
        columns={columns}
        dataSource={list.data?.items ?? []}
        loading={list.isLoading}
        scroll={{ x: 800 }}
        pagination={{
          current: params.page,
          pageSize: params.pageSize,
          total: list.data?.total ?? 0,
          onChange: (page, pageSize) => setParams((p) => ({ ...p, page, pageSize })),
        }}
      />

      <Modal
        title={editing ? '编辑礼金' : '新增礼金'}
        open={creating}
        onCancel={() => {
          setCreating(false);
          setEditing(null);
        }}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} initialValues={{ method: 'cash' }}>
          <Form.Item name="guestName" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input disabled={!!editing} />
          </Form.Item>
          <Form.Item name="amountYuan" label="金额（元）" rules={[{ required: true, message: '请输入金额' }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="method" label="方式" rules={[{ required: true }]}>
            <Select options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
