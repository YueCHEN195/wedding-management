import { useEffect, useRef, useState } from 'react';
import type { Attending, RsvpDTO } from '@shared/types';
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [nameError, setNameError] = useState(false);
  const [savedReply, setSavedReply] = useState<RsvpDTO | null>(null);
  const [saveVersion, setSaveVersion] = useState(0);
  const savingRef = useRef(false);

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
        setSavedReply(d.rsvp);
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
    if (savingRef.current || loading || loadError || invalid) return;
    setSubmitError(null);
    setNameError(false);
    if (universal && !nameInput.trim()) {
      setNameError(true);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const payload = {
        attending,
        headcount: attending === 'yes' ? headcount : 0,
        childrenCount: attending === 'yes' ? children : 0,
        message,
      };
      const response = token
        ? await api.invite.rsvp(token, payload)
        : await api.invite.universalRsvp({ ...payload, name: nameInput.trim() });
      setSavedReply(response);
      setSubmitted(true);
      setSaveVersion((version) => version + 1);
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : '提交失败，请稍后再试');
    } finally {
      savingRef.current = false;
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
    setSavedReply(null);
    setSaveVersion(0);
    setSubmitError(null);
    setNameError(false);
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
    submitError,
    nameError,
    savedReply,
    saveVersion,
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
