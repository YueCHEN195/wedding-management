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
  const page = Math.max(1, Number(u.searchParams.get('page') ?? 1) || 1);
  const rawSize = Number(u.searchParams.get('pageSize') ?? defaultSize) || defaultSize;
  const pageSize = Math.min(maxSize, Math.max(1, rawSize));
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
