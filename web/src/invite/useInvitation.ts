import { useEffect, useState } from 'react';
import type { Attending } from '@shared/types';
import { api, ApiError } from '@/api/client';
export function useInvitation(token?: string) {
  const universal = !token;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [invalid, setInvalid] = useState(false);
  const [guestName, setGuestName] = useState<string | null>(null);
  const [salutation, setSalutation] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const [nameInput, setNameInput] = useState('');
  const [attending, setAttending] = useState<Attending>('yes');
  const [headcount, setHeadcount] = useState(1);
  const [children, setChildren] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let alive = true;
    const invitation = token
      ? api.invite.get(token)
      : api.invite.getUniversalRsvp().then((rsvp) => ({ guestName: null, salutation: null, rsvp }));
    invitation
      .then((d) => {
        if (!alive) return;
        setGuestName(d.guestName);
        setSalutation(d.salutation);
        if (d.rsvp) {
          if (!token) setNameInput(d.rsvp.guestName);
          setAttending(d.rsvp.attending);
          setHeadcount(d.rsvp.headcount || 1);
          setChildren(d.rsvp.childrenCount || 0);
          setMessage(d.rsvp.message ?? '');
          setSubmitted(true);
        }
      })
      .catch((e) => {
        if (!alive) return;
        if (token && e instanceof ApiError && e.status === 404) setInvalid(true);
        else setLoadError(e instanceof ApiError ? e.message : '请柬加载失败，请稍后重试');
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [token, loadAttempt]);

  const greeting = salutation ?? guestName ?? null;

  async function submit() {
    if (saving || loading || loadError) return;
    if (universal && !nameInput.trim()) {
      alert('请填写您的姓名');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        attending,
        headcount: attending === 'yes' ? headcount : 0,
        childrenCount: attending === 'yes' ? children : 0,
        message,
      };
      if (token) await api.invite.rsvp(token, payload);
      else await api.invite.universalRsvp({ ...payload, name: nameInput.trim() });
      setSubmitted(true);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : '提交失败，请稍后再试');
    } finally {
      setSaving(false);
    }
  }

  const retry = () => {
    setLoading(true);
    setLoadError(null);
    setInvalid(false);
    setGuestName(null);
    setSalutation(null);
    setNameInput('');
    setAttending('yes');
    setHeadcount(1);
    setChildren(0);
    setMessage('');
    setSubmitted(false);
    setLoadAttempt((n) => n + 1);
  };
  return {
    universal,
    loading,
    loadError,
    invalid,
    guestName,
    submitted,
    saving,
    nameInput,
    setNameInput,
    attending,
    setAttending,
    headcount,
    setHeadcount,
    children,
    setChildren,
    message,
    setMessage,
    greeting,
    submit,
    retry,
  };
}
export type InvitationModel = ReturnType<typeof useInvitation>;
