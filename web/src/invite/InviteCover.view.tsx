import { useState } from 'react';
import { wedding } from '@shared/wedding';
import { weddingDisplay } from './invitationFormat';
import { ProgressivePhoto } from '../guest/ProgressivePhoto';

export function InviteCover({ onOpen }: { onOpen: () => void }) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <section className="invite-cover" aria-label="请柬封面">
      <div className="invite-cover-visual" aria-hidden="true">
        {wedding.images.cover && !imageFailed ? (
          <ProgressivePhoto
            src={wedding.images.cover}
            alt=""
            fetchPriority="high"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="invite-placeholder">相聚</span>
        )}
      </div>
      <div className="invite-cover-shade" aria-hidden="true" />
      <p className="guest-brand invite-cover-brand">
        <span className="guest-brand-mark" aria-hidden="true" />
        诚邀 · 相聚
      </p>
      <div className="invite-cover-copy">
        <p className="invite-eyebrow">THE WEDDING</p>
        <h1>{wedding.coverTitle}</h1>
        <p className="invite-couple">
          {wedding.groomName}
          <span>与</span>
          {wedding.brideName}
        </p>
      </div>
      <footer className="invite-cover-footer">
        <p>
          <time dateTime={wedding.date}>{weddingDisplay.date}</time>
          <span>
            {weddingDisplay.weekday} · {weddingDisplay.opening} 开席
          </span>
        </p>
        <button onClick={onOpen} type="button" className="invite-open">
          打开请柬<span aria-hidden="true">↓</span>
        </button>
        <p className="invite-swipe">或下滑，赴这场相聚</p>
      </footer>
    </section>
  );
}
