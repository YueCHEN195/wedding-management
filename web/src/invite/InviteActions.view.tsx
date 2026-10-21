import { useEffect, useState } from 'react';
import { wedding } from '@shared/wedding';
import { share } from './invitationActions';

const SHARE_FEEDBACK_MS = 4000;
export function InviteActions({ universal }: { universal: boolean }) {
  const [feedback, setFeedback] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(''), SHARE_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [feedback]);
  return (
    <footer className="invite-actions">
      <p className="invite-signature">
        {wedding.groomName} 与 {wedding.brideName} 敬邀
      </p>
      <div>
        {wedding.contact.phone && <a href={`tel:${wedding.contact.phone}`}>联系新人</a>}
        <button
          className="invite-text-button"
          type="button"
          onClick={async () => {
            const result = await share();
            setFailed(result === 'failed');
            setFeedback(
              result === 'copied' ? '请柬链接已复制' : result === 'shared' ? '分享已完成' : '',
            );
          }}
        >
          分享请柬 ↗
        </button>
      </div>
      {!universal && <p className="invite-helper">这是专属请柬，请仅分享给受邀本人。</p>}
      {feedback && (
        <p className="invite-toast" role="status">
          {feedback}
        </p>
      )}
      {failed && (
        <div className="invite-share-error">
          <p role="alert">暂时无法分享，请长按下方链接手动复制。</p>
          <input
            aria-label="请柬链接"
            readOnly
            value={window.location.href}
            onFocus={(event) => event.target.select()}
          />
        </div>
      )}
    </footer>
  );
}
