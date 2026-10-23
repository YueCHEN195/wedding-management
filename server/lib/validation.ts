import type { Context } from 'hono';
import { z } from 'zod';
import { MAX_GIFT_CENTS, MAX_GROUP_LENGTH, MAX_HEADCOUNT, MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from '../../shared/constraints';

export class InputError extends Error { readonly code = 'VALIDATION'; }
export class WriteConflictError extends Error { readonly code = 'VERSION_CONFLICT'; }
export function inputErrorHandler(err: Error, c: Context) {
  if (err instanceof WriteConflictError) return c.json({ ok: false, error: { code: err.code, message: err.message } }, 409);
  if (err instanceof InputError) return c.json({ ok: false, error: { code: err.code, message: err.message } }, 400);
  throw err;
}
export function parseInput<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new InputError(message);
  return result.data;
}
export function parseId(value: string): number {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new InputError('记录编号必须为有效正整数');
  return Number(value);
}
export function enumQuery<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  if (value == null || value === '') return null;
  if (!allowed.includes(value as T)) throw new InputError('筛选条件无效，请重新选择');
  return value as T;
}
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => v || null);
const name = z.string().trim().min(1).max(MAX_NAME_LENGTH);
const count = z.number().int().min(0).max(MAX_HEADCOUNT);
export const attendingSchema = z.enum(['yes', 'no', 'maybe']);
const rsvpFields = z.object({ attending: attendingSchema, headcount: count, childrenCount: count.default(0), message: optionalText(MAX_TEXT_LENGTH) });
export const rsvpInputSchema = rsvpFields.superRefine((value, ctx) => {
  if (value.attending === 'yes' && (value.headcount < 1 || value.childrenCount > value.headcount)) {
    ctx.addIssue({ code: 'custom', message: '出席总人数至少1人，儿童人数不能超过总人数' });
  }
});
export const universalRsvpSchema = rsvpInputSchema.safeExtend({ name });
export const rsvpPatchSchema = rsvpFields.extend({ childrenCount: count }).partial().strict().refine((v) => Object.keys(v).length > 0);
export function normalizedRsvp(value: z.infer<typeof rsvpInputSchema>) {
  return { ...value, headcount: value.attending === 'yes' ? value.headcount : 0, childrenCount: value.attending === 'yes' ? value.childrenCount : 0 };
}
const money = z.number().int().safe().min(1).max(MAX_GIFT_CENTS);
const method = z.enum(['cash', 'wechat', 'alipay']);
export const giftCreateSchema = z.object({ submissionKey: z.uuid(), guestName: name, guestId: z.number().int().positive().safe().nullable().optional(),
  amount: money, method: method.default('cash'), note: optionalText(MAX_TEXT_LENGTH) }).strict();
export const giftPatchSchema = z.object({ amount: money.optional(), method: method.optional(), note: optionalText(MAX_TEXT_LENGTH).optional(),
  expectedVersion: z.number().int().positive().safe(), reason: z.string().trim().min(1).max(200) }).strict()
  .refine((v) => v.amount !== undefined || v.method !== undefined || v.note !== undefined);
export const guestCreateSchema = z.object({ name, salutation: optionalText(30), phone: optionalText(30),
  groupName: optionalText(MAX_GROUP_LENGTH), side: z.enum(['male', 'female', 'both']).nullable().optional(), note: optionalText(MAX_TEXT_LENGTH) }).strict();
export const guestPatchSchema = guestCreateSchema.partial().refine((v) => Object.keys(v).length > 0);
export const RSVP_INPUT_MESSAGE = '请核对出席状态及人数：总人数须为0–20的整数，出席至少1人，儿童不超过总人数，留言最多500字';
export const GIFT_INPUT_MESSAGE = '请核对姓名、宾客与礼金：金额为0.01–100000元、最多两位小数；方式为现金、微信或支付宝，备注最多500字';
export const GUEST_INPUT_MESSAGE = '请核对宾客信息：姓名1–50字、称谓及电话最多30字、分组最多50字、备注最多500字，归属为男方、女方或双方';
