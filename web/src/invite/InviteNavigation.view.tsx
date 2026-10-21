import { useRef } from 'react';
import { wedding } from '@shared/wedding';
import { getMapLinks } from './invitationActions';

export function InviteNavigation() {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        className="invite-navigation"
        type="button"
        aria-haspopup="dialog"
        aria-controls="invite-map"
        onClick={() => dialog.current?.showModal()}
      >
        导航 ↗
      </button>
      <dialog
        className="guest-experience invite-map"
        id="invite-map"
        ref={dialog}
        aria-labelledby="invite-map-title"
        onClick={(event) => {
          if (event.target !== dialog.current) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            dialog.current?.close();
        }}
      >
        <header>
          <h2 id="invite-map-title">赴约导航</h2>
          <button type="button" onClick={() => dialog.current?.close()}>
            关闭
          </button>
        </header>
        <h3>{wedding.venue.name}</h3>
        <p>{wedding.venue.address}</p>
        <div className="invite-map-options">
          {getMapLinks().map((map) => (
            <a
              href={map.href}
              key={map.label}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
            >
              {map.label}
              <span>搜索门店 ↗</span>
            </a>
          ))}
        </div>
        <p className="invite-map-helper">
          打开地图后，请核对“滨江新城店”再开始导航。本页不请求定位权限。
        </p>
      </dialog>
    </>
  );
}
