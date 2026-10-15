import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { Alert, Button, Card, Empty, Form, Image, Input, InputNumber, List, Modal, Select, Space, Tag, Typography, message } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { RecordAction, type RecordActionTarget } from './components/RecordAction';
import { api, ApiError } from '@/api/client';
import type { CheckinDTO, GiftMethod, GuestCandidate, NewCheckinGuest } from '@shared/types';
import { ATTENDING_LABEL, METHOD_LABEL, SIDE_LABEL, formatDateTime } from '@/lib/format';

interface CheckinFormValues {
  guestId?: number | 'new';
  newGuest?: NewCheckinGuest;
  amountYuan?: number;
  method?: GiftMethod;
  note?: string;
}
function guestChoice(v: CheckinFormValues) {
  return v.guestId === 'new' ? { newGuest: v.newGuest } : { guestId: v.guestId };
}
function GuestSelection({ query }: { query: UseQueryResult<GuestCandidate[], Error> }) {
  const form = Form.useFormInstance();
  const selection = Form.useWatch('guestId', form);
  if (query.isPending) return <Typography.Paragraph>正在核对宾客名单…</Typography.Paragraph>;
  if (query.isError) return <Alert type="error" showIcon title="宾客名单加载失败，请重试后再确认" action={<Button onClick={() => query.refetch()}>重试</Button>} />;
  const candidates = query.data;
  if (candidates.length === 0) return <Alert type="info" title="未找到同名宾客，确认后将自动建立新档案" style={{ marginBottom: 16 }} />;
  const label = (g: GuestCandidate) => `#${g.id} · ${g.name} · ${g.checkedIn ? '已签到' : '未签到'} · ${g.side ? SIDE_LABEL[g.side] : '归属未填'} · ${g.groupName || '未分组'} · ${g.attending ? ATTENDING_LABEL[g.attending] : '未回执'}${g.attending === 'yes' ? ` ${g.headcount}人` : ''}`;
  return (
    <>
      <Alert type="info" showIcon title="请核对是否为名单中的本人；如果是另一位同名宾客，请选择新建" style={{ marginBottom: 16 }} />
      <Form.Item name="guestId" label="对应宾客" rules={[{ required: true, message: '请选择对应宾客，或新增另一位同名宾客' }]}>
        <Select placeholder="核对已有宾客，或新增另一位同名宾客" options={[
          ...candidates.map((g) => ({ value: g.id as number | 'new', label: label(g), disabled: g.checkedIn })),
          { value: 'new' as const, label: '都不是，新增另一位同名宾客' },
        ]} optionRender={(option) => <span style={{ whiteSpace: 'normal' }}>{option.label}</span>} />
      </Form.Item>
      {selection === 'new' && <>
        <Typography.Paragraph type="secondary">确认是另一位本人后再新建；同一人追加礼金请到礼金管理登记。</Typography.Paragraph>
        <Form.Item name={['newGuest', 'groupName']} label="辨识分组" preserve={false} rules={[{ required: true, whitespace: true, max: 50, message: '请填写辨识分组（最多50字）' }]}>
          <Input placeholder="例如：新郎同事带来的朋友" maxLength={50} />
        </Form.Item>
        <Form.Item name={['newGuest', 'side']} label="归属方（可选）" preserve={false}>
          <Select allowClear placeholder="请选择" options={Object.entries(SIDE_LABEL).map(([value, label]) => ({ value, label }))} />
        </Form.Item>
      </>}
    </>
  );
}

export function ReviewPage() {
  const qc = useQueryClient();
  const [recordAction, setRecordAction] = useState<RecordActionTarget | null>(null);
  const [confirming, setConfirming] = useState<CheckinDTO | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSubmissionKey, setManualSubmissionKey] = useState<string | null>(null);
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
    manualForm.setFieldsValue({ guestId: undefined, newGuest: undefined });
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
    qc.invalidateQueries({ queryKey: ['gifts'] });
    qc.invalidateQueries({ queryKey: ['guests'] });
    qc.invalidateQueries({ queryKey: ['guest-detail'] });
  };

  const confirm = useMutation({
    mutationFn: (v: CheckinFormValues) =>
      api.checkins.confirm(confirming!.id, { ...guestChoice(v), amount: Math.round((v.amountYuan ?? 0) * 100), method: v.method ?? 'wechat', note: v.note }),
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

  const manual = useMutation({
    mutationFn: (v: CheckinFormValues & { guestName: string }) =>
      api.checkins.createManual({
        guestName: v.guestName,
        submissionKey: manualSubmissionKey!,
        ...guestChoice(v),
        amount: v.amountYuan ? Math.round(v.amountYuan * 100) : 0,
        method: v.method ?? 'cash',
        note: v.note,
      }),
    onSuccess: (data) => {
      message.success(data.duplicate ? '本次补录已保存，未重复登记' : '已补录');
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
      {recordAction && <RecordAction target={recordAction} onClose={() => setRecordAction(null)} />}
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
            setManualSubmissionKey(crypto.randomUUID());
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
                  <a key="no" onClick={() => setRecordAction({ entity: 'checkin', id: item.id, action: 'reject' })}>驳回</a>,
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
        okButtonProps={{ disabled: confirming?.guestArchived || confirmCandidates.isFetching || confirmCandidates.isError }}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => confirm.mutate(v)}>
          {confirming && <>{confirming.guestArchived && <Alert type="warning" title="关联宾客已归档，请先联系管理员恢复宾客，或驳回此提交" />}<GuestSelection query={confirmCandidates} /></>}
          <Form.Item name="amountYuan" label="礼金金额（元，没有礼金填 0）" rules={[{ required: true, message: '请填写金额' }]}>
            <InputNumber min={0} max={100000} precision={2} style={{ width: '100%' }} placeholder="0" />
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
        okButtonProps={{ disabled: !manualSubmissionKey || !!manualName && (manualCandidates.isFetching || manualCandidates.isError) }}
        destroyOnClose
      >
        <Form form={manualForm} layout="vertical" onFinish={(v) => manual.mutate(v)} initialValues={{ method: 'cash' }}>
          <Form.Item name="guestName" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input />
          </Form.Item>
          {manualName && <GuestSelection query={manualCandidates} />}
          <Form.Item name="amountYuan" label="礼金金额（元，可填 0）">
            <InputNumber min={0} max={100000} precision={2} style={{ width: '100%' }} placeholder="0" />
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
