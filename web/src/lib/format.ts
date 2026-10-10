import type { Attending, CheckinStatus, GiftMethod, GuestStatus, Side } from '@shared/types';

export const STATUS_LABEL: Record<GuestStatus, string> = {
  pending: '待邀请',
  sent: '已发送',
  viewed: '已查看',
  rsvp: '已回执',
};

export const STATUS_COLOR: Record<GuestStatus, string> = {
  pending: 'default',
  sent: 'blue',
  viewed: 'orange',
  rsvp: 'green',
};

export const SIDE_LABEL: Record<Side, string> = { male: '男方', female: '女方', both: '双方' };

export const ATTENDING_LABEL: Record<Attending, string> = { yes: '出席', no: '不出席', maybe: '待定' };
export const ATTENDING_COLOR: Record<Attending, string> = { yes: 'green', no: 'red', maybe: 'orange' };

export const METHOD_LABEL: Record<GiftMethod, string> = { wechat: '微信', alipay: '支付宝', cash: '现金' };

export const CHECKIN_STATUS_LABEL: Record<CheckinStatus, string> = { pending: '待审核', confirmed: '已确认' };

/** 分 → 元字符串 */
export function yuan(cents: number | null | undefined): string {
  if (cents == null) return '-';
  return (cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function yuanValue(cents: number | null | undefined): number {
  return cents == null ? 0 : cents / 100;
}

export function formatDateTime(ms: number | null | undefined): string {
  if (!ms) return '-';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
