import { useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { wedding } from '@shared/wedding';
import { weddingDisplay } from './invitationFormat';
import { ProgressivePhoto } from '../guest/ProgressivePhoto';
import type { useCountdown } from './useCountdown';
import type { InvitationModel } from './useInvitation';
import { RsvpForm } from './RsvpForm.view';
import { InviteNavigation } from './InviteNavigation.view';
import { InviteActions } from './InviteActions.view';
import { RSVP_FORM_ID, rsvpSubmitLabel } from './rsvpPresentation';

export function InviteContent({
  model,
  cd,
  detailRef,
  actionRoot,
  actionsReady,
  onBackCover,
}: {
  model: InvitationModel;
  cd: ReturnType<typeof useCountdown>;
  detailRef: RefObject<HTMLElement | null>;
  actionRoot: HTMLElement | null;
  actionsReady: boolean;
  onBackCover: () => void;
}) {
  const reply = useRef<HTMLDetailsElement>(null);
  const [detailImageFailed, setDetailImageFailed] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [editVersion, setEditVersion] = useState(0);
  const showReceipt = Boolean(model.savedReply) && model.saveVersion > editVersion;
  const openReply = () => {
    if (!reply.current) return;
    reply.current.open = true;
    reply.current.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
    reply.current.querySelector('summary')?.focus({ preventScroll: true });
  };
  return (
    <section
      className="invite-content"
      ref={detailRef}
      tabIndex={-1}
      aria-labelledby="invite-greeting"
    >
      <p className="invite-eyebrow">诚 挚 邀 请</p>
      <h2 id="invite-greeting">{model.greeting ? `亲爱的${model.greeting}` : '亲爱的亲友'}</h2>
      <p className="invite-letter">{wedding.invitationText.replace('，', '，\n')}</p>
      {!detailImageFailed && (
        <ProgressivePhoto
          className="invite-detail-photo"
          src={wedding.images.detail}
          alt="两人手持烟花的夜景婚纱合照"
          width={1600}
          height={1067}
          loading="lazy"
          decoding="async"
          onError={() => setDetailImageFailed(true)}
        />
      )}
      <div className="invite-event">
        <time dateTime={wedding.date}>
          {weddingDisplay.date} · {weddingDisplay.weekday}
        </time>
        <p className="invite-opening">{weddingDisplay.opening} 开席</p>
        <div className="invite-venue">
          <div>
            <p>{wedding.venue.name}</p>
            <p className="invite-helper">{wedding.venue.address}</p>
          </div>
          <InviteNavigation />
        </div>
      </div>
      <p className="invite-arrival">{wedding.closingText}</p>
      <button className="invite-primary invite-open-inline" type="button" onClick={openReply}>
        {model.submitted ? '查看或修改回执' : '填写回执'} <span aria-hidden="true">↗</span>
      </button>
      <button className="invite-text-button invite-back-cover" type="button" onClick={onBackCover}>
        返回封面
      </button>
      <details className="invite-extras">
        <summary>婚礼安排</summary>
        <div className="invite-extra-body">
          <p>
            {weddingDisplay.fullDate} · {weddingDisplay.weekday}
          </p>
          {wedding.schedule.map((item) => (
            <p key={item.time}>
              {item.time} · {item.title}
            </p>
          ))}
          <p className="invite-helper">
            {cd.arrived
              ? '期待这场相聚。'
              : `距离相聚还有 ${cd.days} 天 ${cd.hours} 时 ${cd.minutes} 分`}
          </p>
        </div>
      </details>
      {(wedding.story || wedding.images.gallery.length > 0) && (
        <details className="invite-extras">
          <summary>影像与故事</summary>
          <div className="invite-extra-body">
            {wedding.story && <p>{wedding.story}</p>}
            <div className="invite-gallery">
              {wedding.images.gallery.map((src, index) => (
                <ProgressivePhoto
                  key={src}
                  src={src}
                  alt={`婚礼相册照片 ${index + 1}`}
                  loading="lazy"
                  decoding="async"
                />
              ))}
            </div>
          </div>
        </details>
      )}
      <details
        className="invite-reply"
        ref={reply}
        onToggle={(event) => setReplyOpen(event.currentTarget.open)}
      >
        <summary>出席回执</summary>
        <RsvpForm
          model={model}
          showReceipt={showReceipt}
          onEdit={() => setEditVersion(model.saveVersion)}
          onBack={() => {
            if (reply.current) reply.current.open = false;
            detailRef.current?.scrollIntoView({
              behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 'instant'
                : 'smooth',
            });
            detailRef.current?.focus({ preventScroll: true });
          }}
        />
      </details>
      <InviteActions universal={model.universal} />
      {actionRoot &&
        createPortal(
          <div
            className="invite-mobile-actions"
            hidden={!actionsReady || (replyOpen && showReceipt)}
          >
            {replyOpen ? (
              <button
                className="invite-primary"
                type="submit"
                form={RSVP_FORM_ID}
                disabled={model.saving}
              >
                {rsvpSubmitLabel(model)}
              </button>
            ) : (
              <button className="invite-primary" type="button" onClick={openReply}>
                {model.submitted ? '查看或修改回执' : '填写回执'}
                <span aria-hidden="true">↗</span>
              </button>
            )}
          </div>,
          actionRoot,
        )}
    </section>
  );
}
