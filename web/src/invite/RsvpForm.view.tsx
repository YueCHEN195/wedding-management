import { useEffect, useRef } from 'react';
import { MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from '@shared/constraints';
import { wedding } from '@shared/wedding';
import type { InvitationModel } from './useInvitation';
import { RsvpAttendance } from './RsvpAttendance.view';
import { RsvpReceipt } from './RsvpReceipt.view';
import { RSVP_FORM_ID, rsvpSubmitLabel } from './rsvpPresentation';
import './rsvp.css';

export function RsvpForm({
  model,
  onBack,
  showReceipt,
  onEdit,
}: {
  model: InvitationModel;
  onBack: () => void;
  showReceipt: boolean;
  onEdit: () => void;
}) {
  const {
    universal,
    guestName,
    nameInput,
    setNameInput,
    message,
    setMessage,
    submit,
    saving,
    submitted,
    submitError,
    nameError,
    savedReply,
  } = model;
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const hadReceipt = useRef(false);
  const showNameError = nameError && !nameInput.trim();

  useEffect(() => {
    const target = showReceipt ? resultRef.current : hadReceipt.current ? formRef.current : null;
    if (target) {
      target.scrollIntoView({
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        block: 'start',
      });
      if (showReceipt) resultRef.current?.focus({ preventScroll: true });
      else
        formRef.current
          ?.querySelector<HTMLElement>('[name="guest"], input:checked')
          ?.focus({ preventScroll: true });
    }
    hadReceipt.current = showReceipt;
  }, [showReceipt]);

  useEffect(() => {
    if (!submitError) return;
    errorRef.current?.scrollIntoView({ block: 'nearest' });
    errorRef.current?.focus({ preventScroll: true });
  }, [submitError]);

  if (showReceipt && savedReply)
    return <RsvpReceipt reply={savedReply} onEdit={onEdit} onBack={onBack} resultRef={resultRef} />;

  return (
    <form
      autoComplete="off"
      className="rsvp-form"
      id={RSVP_FORM_ID}
      ref={formRef}
      noValidate
      aria-busy={saving}
      onSubmit={(event) => {
        event.preventDefault();
        if (universal && !nameInput.trim())
          formRef.current?.querySelector<HTMLInputElement>('[name="guest"]')?.focus();
        void submit();
      }}
    >
      <header className="rsvp-heading">
        <button className="invite-text-button rsvp-back" type="button" onClick={onBack}>
          ← 返回请柬
        </button>
        <p className="guest-brand">
          <span className="guest-brand-mark" aria-hidden="true" />
          {wedding.groomName}与{wedding.brideName}的婚礼
        </p>
        <h3>{submitted ? '修改你的回音' : '期待与你相见'}</h3>
        <p className="rsvp-helper">
          {submitted
            ? '已带入此前保存的内容，修改后请重新保存。'
            : '留一声回音，便于我们安排席位。'}
        </p>
      </header>
      {universal && !guestName ? (
        <div className="rsvp-field">
          <label htmlFor="rsvp-name">您的姓名</label>
          <input
            id="rsvp-name"
            name="guest"
            type="text"
            value={nameInput}
            maxLength={MAX_NAME_LENGTH}
            required
            autoComplete="off"
            placeholder="请输入本人姓名"
            disabled={saving}
            onChange={(event) => setNameInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault();
            }}
            aria-invalid={showNameError || undefined}
            aria-describedby={
              showNameError ? 'rsvp-name-error rsvp-edit-helper' : 'rsvp-edit-helper'
            }
          />
          {showNameError && (
            <p className="rsvp-error" id="rsvp-name-error" role="alert">
              请填写您的姓名，方便我们核对。
            </p>
          )}
          <p className="rsvp-helper" id="rsvp-edit-helper">
            本浏览器可再次修改；换设备请联系新人协助。
          </p>
        </div>
      ) : (
        <p className="rsvp-identity">
          受邀宾客<span>{guestName ?? '姓名未记录'}</span>
        </p>
      )}
      <RsvpAttendance model={model} />
      <div className="rsvp-field">
        <label htmlFor="rsvp-message">
          祝福留言<span className="rsvp-optional">选填</span>
        </label>
        <textarea
          id="rsvp-message"
          name="message"
          rows={2}
          maxLength={MAX_TEXT_LENGTH}
          value={message}
          placeholder="写下一句祝福…"
          disabled={saving}
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>
      {submitError && (
        <div className="rsvp-submit-error" role="alert" tabIndex={-1} ref={errorRef}>
          <p>{submitError}</p>
          <p className="rsvp-helper">
            填写内容仍在当前页面，请按上方提示处理。关闭页面或换设备可能丢失未保存内容。
          </p>
        </div>
      )}
      <button className="invite-primary rsvp-submit" type="submit" disabled={saving}>
        {rsvpSubmitLabel(model)}
        <span aria-hidden="true">{saving ? '' : '↗'}</span>
      </button>
      <p className="rsvp-helper rsvp-saving" role="status">
        {saving ? '正在发送回执，请稍候。' : ''}
      </p>
    </form>
  );
}
