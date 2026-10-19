import { useRef, useState } from 'react';
import { Form, message } from 'antd';
import { api } from '@/api/client';
import { adminFeedback } from '../theme';
export interface CheckinEntryProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}
export function useCheckinEntry(onCreated: () => void) {
  const [url, setUrl] = useState(() => new URL('/checkin', window.location.origin).href);
  const [form] = Form.useForm<{ name: string }>();
  const attempt = useRef<{ name: string; key: string } | null>(null);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canAdvance, setCanAdvance] = useState(false);
  let validUrl = false;
  let local = false;
  try {
    const parsed = new URL(url);
    validUrl = ['http:', 'https:'].includes(parsed.protocol);
    local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  } catch {
    /* URL input remains editable. */
  }
  const submit = async ({ name }: { name: string }) => {
    if (saving.current) return;
    const normalized = name.trim();
    if (attempt.current?.name !== normalized)
      attempt.current = { name: normalized, key: crypto.randomUUID() };
    saving.current = true;
    setBusy(true);
    setError(null);
    setCanAdvance(false);
    try {
      const response = await api.publicCheckin.self(normalized, attempt.current!.key);
      const result =
        response.status === 'pending'
          ? `${normalized} · ${response.duplicate ? '原提交仍在待审核' : '已加入待审核'} · #${response.id}`
          : `${normalized} · 原提交${response.status === 'confirmed' ? '已确认签到' : '已驳回或撤销'}，请先核对原记录`;
      message.open({
        type: response.status === 'pending' ? 'success' : 'info',
        content: result,
        duration: adminFeedback.toastDuration,
      });
      setCanAdvance(true);
      onCreated();
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : '提交失败'}。姓名已保留，结果未确认时请重试本次提交。`,
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const next = () => {
    form.resetFields();
    attempt.current = null;
    setCanAdvance(false);
    setError(null);
  };
  return { url, setUrl, form, saving, busy, error, canAdvance, validUrl, local, submit, next };
}
export type CheckinEntryModel = ReturnType<typeof useCheckinEntry>;
