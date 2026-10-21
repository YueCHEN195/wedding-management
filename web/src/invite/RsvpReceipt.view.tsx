import type { RefObject } from 'react';
import type { RsvpDTO } from '@shared/types';
import { rsvpCopy } from './rsvpPresentation';

export function RsvpReceipt({
  reply,
  onEdit,
  onBack,
  resultRef,
}: {
  reply: RsvpDTO;
  onEdit: () => void;
  onBack: () => void;
  resultRef: RefObject<HTMLElement | null>;
}) {
  const copy = rsvpCopy[reply.attending];
  return (
    <section
      className="rsvp-receipt"
      ref={resultRef}
      tabIndex={-1}
      aria-labelledby="rsvp-receipt-title"
      aria-describedby="rsvp-receipt-note"
    >
      <span className="rsvp-saved-mark" aria-hidden="true">
        ✓
      </span>
      <p className="rsvp-helper">回执已保存</p>
      <h3 id="rsvp-receipt-title">{copy.title}</h3>
      <p className="rsvp-helper" id="rsvp-receipt-note">
        {copy.note}
      </p>
      <dl className="rsvp-receipt-summary">
        <div>
          <dt>姓名</dt>
          <dd>{reply.guestName}</dd>
        </div>
        <div>
          <dt>出席意向</dt>
          <dd>{copy.label}</dd>
        </div>
        {reply.attending === 'yes' && (
          <div>
            <dt>出席人数</dt>
            <dd>
              {reply.headcount} 人（含儿童 {reply.childrenCount} 人）
            </dd>
          </div>
        )}
        {reply.message && (
          <div className="rsvp-receipt-message">
            <dt>祝福留言</dt>
            <dd>{reply.message}</dd>
          </div>
        )}
      </dl>
      <button className="invite-primary" type="button" onClick={onEdit}>
        修改回执
      </button>
      <button className="invite-text-button rsvp-return" type="button" onClick={onBack}>
        返回请柬
      </button>
    </section>
  );
}
