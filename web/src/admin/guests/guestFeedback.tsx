import { Modal, Typography, message } from 'antd';
import type { GuestDTO, ImportResult } from '@shared/types';
import { adminFeedback } from '../theme';

export const copyLink = async (g: GuestDTO) => {
  try {
    await navigator.clipboard.writeText(g.inviteUrl);
    message.success({ content: '邀请链接已复制', duration: adminFeedback.toastDuration });
  } catch {
    Modal.info({
      title: '邀请链接',
      content: <Typography.Paragraph copyable>{g.inviteUrl}</Typography.Paragraph>,
    });
  }
};

export function showImportReport(result: ImportResult) {
  if (!result.failed.length) return;
  Modal.warning({
    className: 'admin-dialog',
    title: `已导入${result.created}位，${result.failed.length}行需处理`,
    okText: '返回名单',
    styles: { body: { maxHeight: 'var(--guest-media-max-height)', overflowY: 'auto' } },
    content: (
      <ul>
        {result.failed.map((f) => (
          <li key={f.row}>
            第{f.row}行：{f.reason}
          </li>
        ))}
      </ul>
    ),
  });
}
