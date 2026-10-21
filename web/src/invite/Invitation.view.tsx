import { useRef, useState, type CSSProperties } from 'react';
import type { InvitationModel } from './useInvitation';
import type { useCountdown } from './useCountdown';
import { InviteCover } from './InviteCover.view';
import { InviteContent } from './InviteContent.view';
import { useInviteViewport } from './useInviteViewport';
import '../guest/guest-tokens.css';
import './invitation.css';

export function InvitationView({
  model,
  cd,
}: {
  model: InvitationModel;
  cd: ReturnType<typeof useCountdown>;
}) {
  const detail = useRef<HTMLElement>(null);
  const cover = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const [actionRoot, setActionRoot] = useState<HTMLDivElement | null>(null);
  const ready = !model.loading && !model.invalid && !model.loadError;
  const viewport = useInviteViewport(scroll, detail, Boolean(ready));
  const actionsReady = viewport.reading && !viewport.hideActions;
  return (
    <main
      className="guest-experience guest-invite"
      data-actions-ready={actionsReady}
      style={
        {
          '--invite-visible-height': viewport.height ? `${viewport.height}px` : undefined,
        } as CSSProperties
      }
    >
      {model.loading || model.invalid || model.loadError ? (
        <section
          className="invite-state"
          aria-labelledby="invite-state-title"
          aria-busy={model.loading}
        >
          <p className="invite-eyebrow">诚邀 · 相聚</p>
          <h1 id="invite-state-title">
            {model.loading
              ? '请柬正在展开'
              : model.invalid
                ? '这封请柬暂时无法打开'
                : '暂时无法加载请柬'}
          </h1>
          <p role={model.loadError ? 'alert' : 'status'}>
            {model.loading
              ? '请稍候，马上与你相见。'
              : model.invalid
                ? '请联系新人，核对邀请链接。'
                : model.loadError}
          </p>
          {model.loadError && (
            <button className="invite-primary" onClick={model.retry} type="button">
              重新加载
            </button>
          )}
        </section>
      ) : (
        <div className="invite-scroll" ref={scroll}>
          <div className="invite-document">
            <div ref={cover}>
              <InviteCover
                onOpen={() => {
                  detail.current?.scrollIntoView({
                    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                      ? 'instant'
                      : 'smooth',
                  });
                  detail.current?.focus({ preventScroll: true });
                }}
              />
            </div>
            <InviteContent
              model={model}
              cd={cd}
              detailRef={detail}
              actionRoot={actionRoot}
              actionsReady={actionsReady}
              onBackCover={() => {
                cover.current?.scrollIntoView({
                  behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                    ? 'instant'
                    : 'smooth',
                });
                cover.current?.querySelector('button')?.focus({ preventScroll: true });
              }}
            />
          </div>
        </div>
      )}
      <div className="invite-mobile-action-root" ref={setActionRoot} />
    </main>
  );
}
