import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { Alert, Button, Empty, Form, Image, Input, Modal, Radio, Select, Space, Typography } from 'antd';
import { useNavigate, useOutletContext } from 'react-router-dom';
import type { AdminOutletContext } from './AdminLayout';
import './review.css';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { AttendanceFields, attendanceValues, type AttendanceValues } from './components/AttendanceFields';
import { RecordAction, type RecordActionTarget } from './components/RecordAction';
import { api, ApiError } from '@/api/client';
import type { CheckinDTO, GiftMethod, GuestCandidate, NewCheckinGuest } from '@shared/types';
import { parseGiftYuan } from '@shared/numericInput';
import { attendanceFromRsvp } from '@shared/attendance';
import type { FormInstance } from 'antd';
import { MAX_TEXT_LENGTH } from '@shared/constraints';
import { ATTENDING_LABEL, METHOD_LABEL, SIDE_LABEL, formatDateTime, yuan } from '@/lib/format';

interface CheckinFormValues extends AttendanceValues {
  giftReceipt?: 'none' | 'received';
  guestId?: number | 'new';
  newGuest?: NewCheckinGuest;
  amountYuan?: string;
  method?: GiftMethod;
  note?: string;
}
function checkedAmount(v: CheckinFormValues) {
  if (v.giftReceipt !== 'received') return 0;
  const amount = parseGiftYuan(v.amountYuan);
  if (amount == null) throw new ApiError('VALIDATION', '金额须为0.01–100000元，最多两位小数', 400);
  return amount;
}
function OptionalGiftFields() {
  const form = Form.useFormInstance();
  const received = Form.useWatch('giftReceipt', form) === 'received';
  return <>
    <Form.Item name="giftReceipt" label="礼金登记" rules={[{ required: true }]}>
      <Radio.Group options={[{ value: 'received', label: '同时登记礼金' }, { value: 'none', label: '仅签到，不登记礼金' }]} />
    </Form.Item>
    {!received && <Typography.Paragraph type="secondary">宾客可不赠送礼金，确认后只记录签到。之后收到礼金可到礼金管理单独登记。</Typography.Paragraph>}
    {received && <div className="review-money-fields">
      <Form.Item name="amountYuan" label="实收礼金（元）" preserve={false} rules={[{ required: true, message: '请填写实际收到的金额' }, { validator: (_, v) => parseGiftYuan(v) != null ? Promise.resolve() : Promise.reject(new Error('金额须为0.01–100000元，最多两位小数')) }]}>
        <Input inputMode="decimal" maxLength={12} placeholder="例如：600.00" />
      </Form.Item>
      <Form.Item name="method" label="收款方式" initialValue="cash" preserve={false} rules={[{ required: true, message: '请选择收款方式' }]}>
        <Select options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))} />
      </Form.Item>
    </div>}
  </>;
}
function guestChoice(v: CheckinFormValues) {
  return v.guestId === 'new' ? { newGuest: v.newGuest } : { guestId: v.guestId };
}
function useRsvpAttendance(form: FormInstance, name: string, query: UseQueryResult<GuestCandidate[], Error>, enabled: boolean) {
  const selection = Form.useWatch('guestId', form) as number | 'new' | undefined;
  const lastIdentity = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled) { lastIdentity.current = null; return; }
    if (!query.isSuccess) return;
    const guest = typeof selection === 'number' ? query.data.find((g) => g.id === selection)
      : selection !== 'new' && query.data.length === 1 && !query.data[0].checkedIn ? query.data[0] : undefined;
    const identity = JSON.stringify([name, selection === 'new' ? 'new' : guest?.id ?? null]);
    // 只在换人或首次打开时带入，后台刷新不能覆盖工作人员已修改的人数。
    if (lastIdentity.current === identity) return;
    lastIdentity.current = identity;
    const defaults = attendanceFromRsvp(guest);
    form.setFieldsValue({ actualHeadcountInput: String(defaults.actualHeadcount), actualChildrenInput: String(defaults.actualChildrenCount) });
  }, [enabled, form, name, query.isSuccess, query.data, selection]);
}

function GuestSelection({ query }: { query: UseQueryResult<GuestCandidate[], Error> }) {
  const form = Form.useFormInstance();
  const selection = Form.useWatch('guestId', form);
  if (query.isPending) return <Typography.Paragraph>正在核对宾客名单…</Typography.Paragraph>;
  if (query.isError) return <Alert type="error" showIcon title="宾客名单加载失败，请重试后再确认" action={<Button onClick={() => query.refetch()}>重试</Button>} />;
  const candidates = query.data;
  if (candidates.length === 0) return <Alert type="info" title="未找到同名宾客，确认后将自动建立新档案" style={{ marginBottom: 16 }} />;
  const label = (g: GuestCandidate) => `#${g.id} · ${g.name} · ${g.checkedIn ? '已签到' : '未签到'} · ${g.side ? SIDE_LABEL[g.side] : '归属未填'} · ${g.groupName || '未分组'} · ${g.attending ? ATTENDING_LABEL[g.attending] : '未回执'}${g.attending === 'yes' ? ` ${g.headcount}人（儿童${g.childrenCount ?? 0}人）` : ''}`;
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
  const navigate = useNavigate();
  const { registerNavigationGuard } = useOutletContext<AdminOutletContext>();
  const [recordAction, setRecordAction] = useState<RecordActionTarget | null>(null);
  const [confirming, setConfirming] = useState<CheckinDTO | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSubmissionKey, setManualSubmissionKey] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [manualForm] = Form.useForm();
  const activeForm = manualOpen ? manualForm : form;
  const confirmValues = Form.useWatch([], form);
  const manualValues = Form.useWatch([], manualForm);
  const values = ((manualOpen ? manualValues : confirmValues) ?? {}) as CheckinFormValues & { guestName?: string };
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
  useEffect(() => { manualForm.setFieldsValue({ guestId: undefined, newGuest: undefined }); }, [manualName, manualForm]);
  useRsvpAttendance(form, confirming?.guestName ?? '', confirmCandidates, confirming != null);
  useRsvpAttendance(manualForm, manualName, manualCandidates, manualOpen && !!manualName);

  const pending = useQuery({ queryKey: ['checkins', 'pending'], queryFn: api.checkins.pending, refetchInterval: 5000 });
  const invalidate = () => {
    for (const key of ['checkins', 'checkin-candidates', 'stats', 'gifts', 'guests', 'guest-detail']) qc.invalidateQueries({ queryKey: [key] });
  };
  const saved = (data: CheckinDTO, duplicate = false) => {
    setReceipt(`${data.guestName} · 已确认到场${data.actualHeadcount}人（其中儿童${data.actualChildrenCount}人） · ${data.giftAmount == null ? '未登记礼金' : `礼金 ¥${yuan(data.giftAmount)} · ${data.giftMethod ? METHOD_LABEL[data.giftMethod] : ''}`}${duplicate ? '。本次为重试，未重复登记。' : ''}`);
    setDirty(false); setSubmitError(null); setConfirming(null); setManualOpen(false);
    invalidate();
  };
  const failed = (e: Error) => {
    setSubmitError(e instanceof ApiError && e.code === 'NETWORK'
      ? '连接中断，保存结果待确认。输入已保留，请先刷新待审列表或查看签到记录，再用本次原操作重试。'
      : `${e.message || '保存失败'}。输入已保留，请核对后重试。`);
    // 不清空宾客选择或人数，保留现场已经核对的输入。
    pending.refetch();
  };
  const confirm = useMutation({
    mutationFn: (v: CheckinFormValues) => api.checkins.confirm(confirming!.id, {
      ...attendanceValues(v), ...guestChoice(v), amount: checkedAmount(v), method: v.method ?? 'cash', note: v.note,
    }),
    onSuccess: (data) => saved(data), onError: failed,
  });
  const manual = useMutation({
    mutationFn: (v: CheckinFormValues & { guestName: string }) => api.checkins.createManual({
      ...attendanceValues(v), guestName: v.guestName, submissionKey: manualSubmissionKey!, ...guestChoice(v),
      amount: checkedAmount(v), method: v.method ?? 'cash', note: v.note,
    }),
    onSuccess: (data) => saved(data, data.duplicate), onError: failed,
  });
  const saving = confirm.isPending || manual.isPending;
  const canLeave = () => new Promise<boolean>((resolve) => {
    if (saving) { resolve(false); return; }
    if (!dirty) { resolve(true); return; }
    Modal.confirm({ title: '当前填写尚未保存', content: '离开这条记录会丢弃本次输入，确认离开吗？',
      okText: '丢弃输入并离开', cancelText: '继续填写', onOk: () => resolve(true), onCancel: () => resolve(false) });
  });
  useEffect(() => registerNavigationGuard(canLeave), [registerNavigationGuard, dirty, saving]);
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => { if (dirty || saving) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty, saving]);
  const switchDraft = async (next: () => void) => {
    if (!await canLeave()) return;
    setDirty(false); setSubmitError(null); setReceipt(null); next();
  };
  const openTicket = (item: CheckinDTO) => {
    if (confirming?.id === item.id && !manualOpen) return;
    void switchDraft(() => {
      form.resetFields(); setManualOpen(false); setConfirming(item);
      form.setFieldsValue({ giftReceipt: 'received', actualHeadcountInput: '1', actualChildrenInput: '0' });
    });
  };
  const openManual = () => {
    if (manualOpen) return;
    void switchDraft(() => { manualForm.resetFields(); setConfirming(null); setManualSubmissionKey(crypto.randomUUID()); setManualOpen(true); });
  };
  const goToRecords = () => { void switchDraft(() => navigate('/admin/checkins')); };
  const items = pending.data ?? [];
  const noLongerPending = confirming != null && pending.data != null && !items.some((r) => r.id === confirming.id);
  const candidates = manualOpen ? manualCandidates : confirmCandidates;
  const active = manualOpen || confirming != null;
  const received = values.giftReceipt !== 'none';
  const amount = parseGiftYuan(values.amountYuan);
  const displayName = manualOpen ? manualName || '待填写姓名' : confirming?.guestName ?? '';
  const saveLabel = received ? `确认到场并登记${amount == null ? '礼金' : ` ¥${yuan(amount)}`}` : '仅确认到场';
  const blockSave = saving || candidates.isFetching || candidates.isError || noLongerPending || !!confirming?.guestArchived
    || (manualOpen ? !manualName || !manualSubmissionKey : !confirming || pending.isError || pending.isPending);

  return <div className="review-workbench">
    {recordAction && <RecordAction key={`${recordAction.id}-${recordAction.action}`} target={recordAction} onClose={() => setRecordAction(null)} />}
    <div className="review-heading">
      <div><h1>现场审核</h1><p>按提交先后核对宾客、到场人数与礼金</p></div>
      <Button onClick={goToRecords} disabled={saving}>查看签到记录</Button>
    </div>
    <div className="review-toolbar">
      <Space wrap>
        <Button type="primary" icon={<PlusOutlined />} onClick={openManual} disabled={saving}>查人 / 手动补录</Button>
        <Button icon={<ReloadOutlined />} loading={pending.isFetching} onClick={() => pending.refetch()}>刷新队列</Button>
        <Button onClick={() => setQrOpen(true)}>现场入口二维码</Button>
      </Space>
      <span className="review-connection">{pending.dataUpdatedAt ? `最近更新 ${new Date(pending.dataUpdatedAt).toLocaleTimeString('zh-CN', { hour12: false })} · 每5秒刷新` : '正在连接待审队列'}</span>
    </div>
    {pending.isError && <Alert showIcon type="error" title={pending.data ? '队列刷新失败，当前显示上次成功的数据' : '无法加载待审队列'}
      description="请检查连接后重试；连接失败不代表没有待审宾客。当前填写内容会保留。" action={<Button onClick={() => pending.refetch()}>重试连接</Button>} />}
    {receipt && <Alert showIcon type="success" title="已保存" description={receipt} action={<Button onClick={() => setReceipt(null)}>知道了</Button>} />}
    <div className="review-grid">
      <aside className="review-queue" aria-label="待审核队列">
        <div className="review-queue-heading"><h2>待审核 {pending.data ? `（${items.length}）` : ''}</h2><span className="review-connection">先到先处理</span></div>
        <div className="review-queue-list">
          {pending.isPending ? <div className="review-placeholder" role="status">正在加载待审提交…</div>
            : !pending.data ? <div className="review-placeholder">队列尚未加载成功，请重试连接。</div>
              : items.length === 0 ? <div className="review-placeholder"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={pending.isError ? '上次加载时无待审提交，当前状态未知' : '当前没有待审提交'} /></div>
                : items.map((item) => <button key={item.id} className="review-ticket" aria-pressed={confirming?.id === item.id && !manualOpen}
                  disabled={saving} onClick={() => openTicket(item)}>
                  <strong>{item.guestName}</strong><small>#{item.id} · {item.source === 'self' ? '自助扫码' : '手动补录'} · {formatDateTime(item.submittedAt)}</small>
                  {(item.guestArchived || item.requiresGuestSelection) && <small className="review-ticket-hint">{item.guestArchived ? '关联宾客已归档' : '同名宾客，请核对本人'}</small>}
                </button>)}
        </div>
      </aside>
      <section className="review-panel" aria-label="签到审核工作区">
        {!active ? <div className="review-placeholder"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={receipt ? '本次处理已完成，请选择下一位宾客' : '从左侧选择一位宾客，或查人手动补录'} /></div> : <>
          <div className="review-panel-heading"><div><h2>{manualOpen ? '查人 / 手动补录' : confirming?.guestName}</h2>
            <p>{manualOpen ? '为现场来宾核对档案并登记到场' : `提交 #${confirming?.id} · ${confirming?.source === 'self' ? '自助扫码' : '手动补录'}`}</p></div>
            <span className="review-connection">{dirty ? '有未保存的填写' : '请核对后保存'}</span></div>
          {noLongerPending && <Alert type="warning" showIcon title="这条提交已不在待审核队列，可能已由其他人处理" description="输入已保留，请先查看签到记录核对结果，不能再次确认。" action={<Button onClick={goToRecords}>查看记录</Button>} />}
          {confirming?.guestArchived && <Alert type="warning" showIcon title="关联宾客已归档，请先由管理员恢复，或将本次提交标记无效" />}
          {submitError && <Alert type="error" showIcon title="本次保存未得到成功确认" description={submitError} />}
          <Form key={manualOpen ? 'manual' : `confirm-${confirming?.id}`} form={activeForm} layout="vertical" disabled={saving}
            initialValues={{ giftReceipt: 'received', actualHeadcountInput: '1', actualChildrenInput: '0' }}
            onValuesChange={() => setDirty(true)} onFinish={(v) => manualOpen ? manual.mutate(v) : confirm.mutate(v)}>
            <div className="review-section"><h3>1 · 核对宾客</h3>
              {manualOpen && <Form.Item name="guestName" label="来宾姓名" rules={[{ required: true, whitespace: true, max: 30, message: '请填写姓名（1–30字）' }]}><Input maxLength={30} placeholder="输入姓名查找宾客档案" /></Form.Item>}
              {(!manualOpen || !!manualName) && <GuestSelection query={candidates} />}
            </div>
            <div className="review-section"><h3>2 · 实际到场</h3>
              <Typography.Paragraph type="secondary">总人数包含儿童；出席回执会自动带入，可按现场实际修改。</Typography.Paragraph>
              <div className="review-attendance"><AttendanceFields showHint={false} /></div>
            </div>
            <div className="review-section review-gift"><h3>3 · 礼金登记</h3><OptionalGiftFields />
              <Form.Item name="note" label="备注（可选）" rules={[{ max: MAX_TEXT_LENGTH, message: '备注最多500字' }]}><Input maxLength={MAX_TEXT_LENGTH} placeholder="补充现场核对信息" /></Form.Item>
            </div>
            <div className="review-save">
              <div className="review-save-summary" aria-live="polite">本次登记：<strong>{displayName}</strong> · {(values.actualHeadcountInput ?? '1') || '待填'}人（其中儿童{(values.actualChildrenInput ?? '0') || '待填'}人）<br />
                {received ? `礼金 ${amount == null ? '金额待填写' : `¥${yuan(amount)}`} · ${values.method ? METHOD_LABEL[values.method] : '现金'}` : '仅确认到场，不产生礼金记录'}</div>
              <div className="review-save-actions"><Button type="primary" htmlType="submit" loading={saving} disabled={blockSave}>{saveLabel}</Button>
                <Button disabled={saving} onClick={() => { void switchDraft(() => { setConfirming(null); setManualOpen(false); }); }}>取消填写</Button></div>
            </div>
          </Form>
          {!manualOpen && confirming && <div className="review-secondary-action"><Button type="text" disabled={saving || noLongerPending} onClick={() => setRecordAction({ entity: 'checkin', id: confirming.id, action: 'reject' })}>将此提交标记无效</Button><Typography.Text type="secondary">填写原因后保留原提交，可在签到记录恢复</Typography.Text></div>}
        </>}
      </section>
    </div>
    <Modal title="现场入口总码" open={qrOpen} footer={null} onCancel={() => setQrOpen(false)}><Image src={api.checkins.qrUrl()} width={300} /><Typography.Paragraph type="secondary">宾客扫码进入自助签到页</Typography.Paragraph></Modal>
  </div>;
}
