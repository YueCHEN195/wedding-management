import type { Dispatch, SetStateAction } from 'react';
import type { InvitationModel } from './useInvitation';
import type { useCountdown } from './useCountdown';
import { InviteCover } from './InviteCover.view';
import { InviteContent } from './InviteContent.view';
import { RED, RED_DARK, PAPER, stepBtn } from './invitationStyles';
export function InvitationView({
  model,
  cd,
  opened,
  setOpened,
}: {
  model: InvitationModel;
  cd: ReturnType<typeof useCountdown>;
  opened: boolean;
  setOpened: Dispatch<SetStateAction<boolean>>;
}) {
  const { loading, invalid, loadError, retry } = model;
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: RED,
          color: PAPER,
        }}
      >
        加载中…
      </div>
    );
  }

  if (invalid) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: RED_DARK,
          color: PAPER,
          textAlign: 'center',
          padding: 24,
        }}
      >
        <div>
          <div style={{ fontSize: 48 }}>囍</div>
          <h2>请柬链接有误</h2>
          <p style={{ opacity: 0.8 }}>请联系新人获取正确的邀请链接</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: RED_DARK,
          color: PAPER,
          textAlign: 'center',
          padding: 24,
        }}
      >
        <div>
          <h2>暂时无法加载请柬</h2>
          <p role="alert">{loadError}</p>
          <button
            onClick={retry}
            style={{ ...stepBtn, width: 'auto', height: 'auto', padding: '12px 24px' }}
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: `linear-gradient(180deg, ${RED} 0%, ${RED_DARK} 100%)`,
        minHeight: '100vh',
        color: PAPER,
      }}
    >
      <InviteCover onOpen={() => setOpened(true)} />
      {opened && <InviteContent model={model} cd={cd} />}
    </div>
  );
}
