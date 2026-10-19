import type { ReviewGuestStatus } from '@shared/types';
export const reviewStatusLabels: Record<ReviewGuestStatus, string> = {
  pending: '待审核',
  confirmed: '已签到',
  unconfirmed: '未签到',
};
