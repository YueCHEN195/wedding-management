import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { Alert, Button, Card, Empty, Form, Image, Input, InputNumber, List, Modal, Popconfirm, Select, Space, Tag, Typography, message } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { api, ApiError } from '@/api/client';
import type { CheckinDTO, GiftMethod, GuestCandidate } from '@shared/types';
import { ATTENDING_LABEL, METHOD_LABEL, SIDE_LABEL, formatDateTime } from '@/lib/format';

function GuestSelection({ query }: { query: UseQueryResult<GuestCandidate[], Error> }) {
  if (query.isPending) return <Typography.Paragraph>正在核对宾客名单…</Typography.Paragraph>;
  if (query.isError) return <Alert type="error" showIcon title="宾客名单加载失败，请重试后再确认" action={<Button onClick={() => query.refetch()}>重试</Button>} />;
  const candidates = query.data;
  if (candidates.length === 0) return <Alert type="info" title="未找到同名宾客，确认后将自动建立新档案" style={{ marginBottom: 16 }} />;
  const label = (g: GuestCandidate) => `#${g.id} · ${g.name} · ${g.checkedIn ? '已签到' : '未签到'} · ${g.side ? SIDE_LABEL[g.side] : '归属未填'} · ${g.groupName || '未分组'} · ${g.attending ? ATTENDING_LABEL[g.attending] : '未回执'}${g.attending === 'yes' ? ` ${g.headcount}人` : ''}`;
  if (candidates.length === 1) return <Typography.Paragraph type="secondary">对应宾客：{label(candidates[0])}</Typography.Paragraph>;
  return (
    <>
      <Alert type="warning" showIcon title={`有 ${candidates.length} 位同名宾客，请先核对再选择`} style={{ marginBottom: 16 }} />
      <Form.Item name="guestId" label="对应宾客" rules={[{ required: true, message: '请选择对应宾客，不能自动关联同名记录' }]}>
        <Select placeholder="请核对分组、归属方和回执人数" options={candidates.map((g) => ({ value: g.id, label: label(g) }))} optionRender={(option) => <span style={{ whiteSpace: 'normal' }}>{option.label}</span>} />
      </Form.Item>
    </>
  );
}

export function ReviewPage() {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState<CheckinDTO | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [form] = Form.useForm();
  const [manualForm] = Form.useForm();
  const manualName = ((Form.useWatch('guestName', manualForm) as string | undefined) ?? '').trim();
  const confirmCandidates = useQuery({
    queryKey: ['checkin-candidates', confirming?.guestName],
    queryFn: () => api.checkins.candidates(confirming!.guestName),
    enabled: confirming != null,
    staleTime: 0,
  });
  const manualCandidates = useQuery({
    queryKey: ['checkin-candidates', manualName],
    queryFn: () => api.checkins.candidates(manualName),
    enabled: manualOpen && manualName.length > 0,
    staleTime: 0,
  });
  useEffect(() => {
    manualForm.setFieldValue('guestId', undefined);
  }, [manualName, manualForm]);

  const pending = useQuery({
    queryKey: ['checkins', 'pending'],
    queryFn: api.checkins.pending,
    refetchInterval: 5000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['checkins'] });
    qc.invalidateQueries({ queryKey: ['checkin-candidates'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
  };

  const confirm = useMutation({
    mutationFn: (v: { guestId?: number; amountYuan: number; method: GiftMethod; note?: string }) =>
      api.checkins.confirm(confirming!.id, { guestId: v.guestId, amount: Math.round(v.amountYuan * 100), method: v.method, note: v.note }),
    onSuccess: () => {
      message.success('已确认');
      setConfirming(null);
      invalidate();
    },
    onError: (e) => {
      message.error(e instanceof ApiError ? e.message : '确认失败');
      form.setFieldValue('guestId', undefined);
      confirmCandidates.refetch();
    },
  });

  const reject = useMutation({
    mutationFn: (id: number) => api.checkins.remove(id),
    onSuccess: () => {
      message.success('已驳回');
      invalidate();
    },
  });

  const manual = useMutation({
    mutationFn: (v: { guestName: string; guestId?: number; amountYuan?: number; method?: GiftMethod; note?: string }) =>
      api.checkins.createManual({
        guestName: v.guestName,
        guestId: v.guestId,
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
    onError: (e) => {
      message.error(e instanceof ApiError ? e.message : '补录失败');
      manualForm.setFieldValue('guestId', undefined);
      manualCandidates.refetch();
    },
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
                  <a key="ok" onClick={() => { form.resetFields(); setConfirming(item); form.setFieldsValue({ amountYuan: 0, method: 'wechat' }); }}>
                    确认并记礼金
                  </a>,
                  <Popconfirm key="no" title="驳回后该提交将被删除，确认？" onConfirm={() => reject.mutate(item.id)}>
                    <a style={{ color: '#cf1322' }}>驳回</a>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={<span style={{ fontSize: 16 }}>{item.guestName} {item.requiresGuestSelection && <Tag color="orange">同名待核对</Tag>}</span>}
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
        okButtonProps={{ disabled: confirmCandidates.isFetching || confirmCandidates.isError }}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => confirm.mutate(v)}>
          {confirming && <GuestSelection query={confirmCandidates} />}
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
        okButtonProps={{ disabled: !!manualName && (manualCandidates.isFetching || manualCandidates.isError) }}
        destroyOnClose
      >
        <Form form={manualForm} layout="vertical" onFinish={(v) => manual.mutate(v)} initialValues={{ method: 'cash' }}>
          <Form.Item name="guestName" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input />
          </Form.Item>
          {manualName && <GuestSelection query={manualCandidates} />}
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
