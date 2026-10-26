import { useRef, useState } from 'react';
import { api, ApiError } from '@/api/client';
import { createSubmissionKey } from '@/lib/submissionKey';
const ATTEMPT_KEY = 'wedding.checkin.attempt';
interface CheckinAttempt {
  name: string;
  submissionKey: string;
}
function readAttempt(): CheckinAttempt | null {
  try {
    const saved = JSON.parse(localStorage.getItem(ATTEMPT_KEY) ?? 'null');
    if (
      saved &&
      typeof saved.name === 'string' &&
      saved.name.length <= 30 &&
      typeof saved.submissionKey === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        saved.submissionKey,
      )
    )
      return saved;
  } catch {
    /* 浏览器禁用存储时，仍可在当前页面重试。 */
  }
  return null;
}
function storeAttempt(value: CheckinAttempt | null) {
  try {
    if (value) localStorage.setItem(ATTEMPT_KEY, JSON.stringify(value));
    else localStorage.removeItem(ATTEMPT_KEY);
  } catch {
    /* 使用当前页面的内存状态。 */
  }
}

export function usePublicCheckin() {
  const [attempt, setAttempt] = useState<CheckinAttempt | null>(readAttempt);
  const [name, setName] = useState(attempt?.name ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'dup' | 'confirmed' | 'inactive'>(
    'idle',
  );
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);

  async function submit() {
    if (saving.current) return;
    const n = name.trim();
    if (!n) {
      setError('请输入姓名');
      return;
    }
    setError(null);
    saving.current = true;
    setState('saving');
    try {
      const current =
        attempt?.name === n ? attempt : { name: n, submissionKey: createSubmissionKey() };
      setAttempt(current);
      storeAttempt(current);
      const r = await api.publicCheckin.self(n, current.submissionKey);
      setState(
        r.status === 'rejected' || r.status === 'cancelled'
          ? 'inactive'
          : r.status === 'confirmed'
            ? 'confirmed'
            : r.duplicate
              ? 'dup'
              : 'done',
      );
    } catch (e) {
      setState('idle');
      setError(e instanceof ApiError ? e.message : '提交失败，请重试');
    } finally {
      saving.current = false;
    }
  }
  const next = () => {
    setName('');
    setState('idle');
    setAttempt(null);
    storeAttempt(null);
  };
  return { attempt, name, setName, state, error, submit, next };
}
export type PublicCheckinModel = ReturnType<typeof usePublicCheckin>;
