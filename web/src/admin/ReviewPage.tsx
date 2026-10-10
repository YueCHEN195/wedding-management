import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Empty, Form, Image, Input, InputNumber, List, Modal, Popconfirm, Select, Space, Tag, Typography, message } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { api, ApiError } from '@/api/client';
import type { CheckinDTO, GiftMethod } from '@shared/types';
import { METHOD_LABEL, formatDateTime } from '@/lib/format';

export function ReviewPage() {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState<CheckinDTO | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [form] = Form.useForm();
  const [manualForm] = Form.useForm();

  const pending = useQuery({
    queryKey: ['checkins', 'pending'],
    queryFn: api.checkins.pending,
    refetchInterval: 5000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['checkins'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
  };

  const confirm = useMutation({
    mutationFn: (v: { amountYuan: number; method: GiftMethod; note?: string }) =>
      api.checkins.confirm(confirming!.id, { amount: Math.round(v.amountYuan * 100), method: v.method, note: v.note }),
    onSuccess: () => {
      message.success('已确认');
      setConfirming(null);
      invalidate();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '确认失败'),
  });

  const reject = useMutation({
    mutationFn: (id: number) => api.checkins.remove(id),
    onSuccess: () => {
      message.success('已驳回');
      invalidate();
    },
  });

  const manual = useMutation({
    mutationFn: (v: { guestName: string; amountYuan?: number; method?: GiftMethod; note?: string }) =>
      api.checkins.createManual({
        guestName: v.guestName,
        amount: v.amountYuan ? Math.round(v.amountYuan * 100) : 0,
        method: v.method ?? 'cash',
        note: v.note,
      }),
    onSuccess: () => {
      message.success('已补录');
      setManualOpen(false);
      manualForm.resetFields();
      invalidate();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '补录失败'),
  });

  const items = pending.data ?? [];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>现场审核</Typography.Title>
        <Tag color={items.length ? 'red' : 'default'}>待审核 {items.length}</Tag>
      </Space>

      <Space style={{ marginBottom: 16 }} wrap>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            manualForm.resetFields();
            setManualOpen(true);
          }}
        >
          手动补录
        </Button>
        <Button icon={<ReloadOutlined />} onClick={() => pending.refetch()}>
          刷新
        </Button>
        <Button onClick={() => setQrOpen(true)}>现场入口二维码</Button>
      </Space>

      <Card>
        {items.length === 0 ? (
          <Empty description="暂无待审核提交" />
        ) : (
          <List
            dataSource={items}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <a key="ok" onClick={() => { setConfirming(item); form.setFieldsValue({ amountYuan: 0, method: 'wechat' }); }}>
                    确认并记礼金
                  </a>,
                  <Popconfirm key="no" title="驳回后该提交将被删除，确认？" onConfirm={() => reject.mutate(item.id)}>
                    <a style={{ color: '#cf1322' }}>驳回</a>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={<span style={{ fontSize: 16 }}>{item.guestName}</span>}
                  description={`提交时间：${formatDateTime(item.submittedAt)} · ${item.source === 'self' ? '自助扫码' : '手动补录'}`}
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      <Modal
        title={`确认 · ${confirming?.guestName ?? ''}`}
        open={confirming != null}
        onCancel={() => setConfirming(null)}
        onOk={() => form.submit()}
        confirmLoading={confirm.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => confirm.mutate(v)}>
          <Form.Item name="amountYuan" label="礼金金额（元，没有礼金填 0）" rules={[{ required: true, message: '请填写金额' }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>
          <Form.Item name="method" label="方式" rules={[{ required: true }]}>
            <Select options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="手动补录签到"
        open={manualOpen}
        onCancel={() => setManualOpen(false)}
        onOk={() => manualForm.submit()}
        confirmLoading={manual.isPending}
        destroyOnClose
      >
        <Form form={manualForm} layout="vertical" onFinish={(v) => manual.mutate(v)} initialValues={{ method: 'cash' }}>
          <Form.Item name="guestName" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="amountYuan" label="礼金金额（元，可填 0）">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>
          <Form.Item name="method" label="方式">
            <Select options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="现场入口总码" open={qrOpen} footer={null} onCancel={() => setQrOpen(false)}>
        <Image src={api.checkins.qrUrl()} width={300} />
        <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
          宾客扫码进入自助签到页（入口一个总码）
        </Typography.Paragraph>
      </Modal>
    </div>
  );
}
