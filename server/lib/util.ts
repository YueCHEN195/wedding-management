import { InputError } from './validation';
import { randomBytes } from 'node:crypto';

export function generateToken(): string {
  // 32 位十六进制，不可枚举
  return randomBytes(16).toString('hex');
}

export function now(): number {
  return Date.now();
}

export interface PageParams {
  page: number;
  pageSize: number;
  offset: number;
}

export function parsePage(url: string, defaultSize = 20, maxSize = 100): PageParams {
  const u = new URL(url);
  const integer = (key: string, fallback: number) => {
    const raw = u.searchParams.get(key);
    if (raw == null) return fallback;
    if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw new InputError('页码和每页条数必须为有限正整数');
    return Number(raw);
  };
  const page = integer('page', 1);
  const pageSize = Math.min(maxSize, integer('pageSize', defaultSize));
  if (!Number.isSafeInteger((page - 1) * pageSize)) throw new InputError('页码过大，请重新选择');
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export function optionalStr(v: unknown): string | null {
  const s = str(v);
  return s === '' ? null : s;
}

/** 元 → 分（整数） */
export function yuanToCents(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.round(n * 100);
}

/** 分 → 元 */
export function centsToYuan(cents: number): number {
  return Math.round(cents) / 100;
}
