import { MAX_GIFT_CENTS, MAX_HEADCOUNT } from './constraints';

/** 只解析界面实际显示的文本，不取数字控件缓存，也不四舍五入输入。 */
function parseYuan(value: unknown, allowZero: boolean): number | null {
  if (typeof value !== 'string' || !/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ''] = value.trim().split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents >= (allowZero ? 0 : 1) && cents <= MAX_GIFT_CENTS ? cents : null;
}
export const parseGiftYuan = (value: unknown) => parseYuan(value, false);
export const parseCheckinYuan = (value: unknown) => parseYuan(value, true);

export function parseHeadcount(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return null;
  const count = Number(value.trim());
  return Number.isSafeInteger(count) && count <= MAX_HEADCOUNT ? count : null;
}
