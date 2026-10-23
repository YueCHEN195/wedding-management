import type { GuestDTO } from '@shared/types';
import type { GuestManagementModel } from './useGuestManagement';
import { copyLink } from './guestFeedback';
export function guestMenu(
  g: GuestDTO,
  {
    markSent,
    setMedia,
    setHistoryId,
    setAction,
  }: Pick<GuestManagementModel, 'markSent' | 'setMedia' | 'setHistoryId' | 'setAction'>,
) {
  return [
    ...(g.archivedAt == null && !g.checkedIn
      ? [
          {
            key: 'preview',
            label: (
              <a
                href={`/invite/${encodeURIComponent(g.inviteToken)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                预览请柬
              </a>
            ),
          },
          {
            key: 'copy',
            label: '复制邀请链接',
            onClick: () => {
              void copyLink(g);
            },
          },
          {
            key: 'sent',
            label: '标记已发送',
            disabled: markSent.isPending,
            onClick: () => markSent.mutate(g.id),
          },
          { key: 'qr', label: '专属二维码', onClick: () => setMedia({ guest: g, type: 'qr' }) },
          {
            key: 'poster',
            label: '专属海报',
            onClick: () => setMedia({ guest: g, type: 'poster' }),
          },
        ]
      : []),
    { key: 'history', label: '操作记录', onClick: () => setHistoryId(g.id) },
    { type: 'divider' as const },
    {
      key: 'archive',
      label: g.archivedAt == null ? '归档宾客' : '恢复宾客',
      danger: g.archivedAt == null,
      onClick: () =>
        setAction({
          entity: 'guest',
          id: g.id,
          action: g.archivedAt == null ? 'archive' : 'restore',
        }),
    },
  ];
}
