import { useRef, useState } from 'react';
import { Alert, Button, Form, Input, Modal, QRCode, Space, Typography, message } from 'antd';
import { api } from '@/api/client';
import { adminFeedback } from '../theme';

/** Reuses the public self-check-in flow: adds pending submissions, never confirms attendance. */
export function CheckinEntry({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [url, setUrl] = useState(() => new URL('/checkin', window.location.origin).href);
  const [form] = Form.useForm<{ name: string }>();
  const attempt = useRef<{ name: string; key: string } | null>(null);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canAdvance, setCanAdvance] = useState(false);
  let validUrl = false;
  let local = false;
  try { const parsed = new URL(url); validUrl = ['http:', 'https:'].includes(parsed.protocol); local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname); } catch { /* URL input remains editable. */ }
  const submit = async ({ name }: { name: string }) => {
    if (saving.current) return;
    const normalized = name.trim();
    if (attempt.current?.name !== normalized) attempt.current = { name: normalized, key: crypto.randomUUID() };
    saving.current = true; setBusy(true); setError(null); setCanAdvance(false);
    try {
      const response = await api.publicCheckin.self(normalized, attempt.current!.key);
      const result = response.status === 'pending' ? `${normalized} · ${response.duplicate ? '原提交仍在待审核' : '已加入待审核'} · #${response.id}`
        : `${normalized} · 原提交${response.status === 'confirmed' ? '已确认签到' : '已驳回或撤销'}，请先核对原记录`;
      message.open({ type: response.status === 'pending' ? 'success' : 'info', content: result, duration: adminFeedback.toastDuration });
      setCanAdvance(true);
      onCreated();
    } catch (e) { setError(`${e instanceof Error ? e.message : '提交失败'}。姓名已保留，结果未确认时请重试本次提交。`); }
    finally { saving.current = false; setBusy(false); }
  };
  return <Modal className="admin-dialog" style={{ top: 'var(--space-6)', paddingBottom: 0 }}
    styles={{ container: { display: 'flex', flexDirection: 'column', maxHeight: 'calc(100dvh - 2 * var(--space-6))' },
      header: { flexShrink: 0 }, body: { minHeight: 0, overflowY: 'auto' }, footer: { flexShrink: 0 } }}
    classNames={{ body: 'admin-module-scroll' }} title="扫码签到 / 代登记" open={open} onCancel={() => { if (!saving.current) onClose(); }} footer={<Button disabled={busy} onClick={onClose}>关闭</Button>} mask={{ closable: !busy }} closable={!busy} keyboard={!busy}>
    <div className="checkin-entry-code"><QRCode value={validUrl ? url : ' '} status={validUrl ? 'active' : 'expired'} bordered={false} /></div>
    <Form layout="vertical">
      <Form.Item label="宾客签到地址" validateStatus={validUrl ? undefined : 'error'} help={validUrl ? undefined : '请填写完整的 http 或 https 地址'}>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} aria-label="宾客签到地址" />
      </Form.Item>
    </Form>
    {local && <Alert type="warning" showIcon title="手机不能访问电脑的 localhost 地址" description="请改填同一网络内电脑的IP地址，或已部署的网站地址，然后重新扫码。" />}
    <Space wrap><Button href={validUrl ? url : undefined} target="_blank" rel="noopener noreferrer" disabled={!validUrl}>打开宾客签到页</Button></Space>
    <Typography.Title level={5}>代填姓名，加入待审核</Typography.Title>
    <Typography.Paragraph type="secondary">宾客不便扫码时可在这里代登记，之后仍需核对身份和到场人数。</Typography.Paragraph>
    {error && <Alert type="error" showIcon title="提交未得到成功确认" description={error} />}
    <Form name="pending-entry" form={form} layout="vertical" onFinish={submit} disabled={busy}>
      <Form.Item name="name" label="来宾姓名" rules={[{ required: true, whitespace: true, max: 30, message: '请填写姓名（1–30字）' }]}><Input aria-label="代登记来宾姓名" maxLength={30} autoComplete="off" /></Form.Item>
      <Space wrap><Button type="primary" htmlType="submit" loading={busy}>加入待审核</Button>
        <Button disabled={busy || !canAdvance} onClick={() => { form.resetFields(); attempt.current = null; setCanAdvance(false); setError(null); }}>登记下一位</Button></Space>
    </Form>
  </Modal>;
}
