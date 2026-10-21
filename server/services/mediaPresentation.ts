import { wedding } from '../../shared/wedding';

export const ARTWORK_TOKENS = {
  night: '#191e1a',
  text: '#f4eee3',
  muted: '#c1bbaa',
  divider: '#4a4e44',
  fontUi: 'PingFang SC, Microsoft YaHei, Noto Sans CJK SC, sans-serif',
  fontBook: 'Songti SC, STSong, SimSun, Noto Serif CJK SC, serif',
} as const;

export function escapeXml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!,
  );
}

/** Local/test/non-HTTPS destinations must never be mistaken for distributable artwork. */
export function isPreviewDestination(value: string) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  return (
    url.protocol !== 'https:' ||
    !host.includes('.') ||
    /(^|\.)(localhost|local|invalid|test|example)$/.test(host) ||
    /(^|\.)example\.(com|net|org)$/.test(host) ||
    /^[\d.]+$/.test(host) ||
    host.startsWith('[')
  );
}

export function artworkText(url: string) {
  const date = new Date(wedding.date);
  const options = { timeZone: 'Asia/Shanghai' } as const;
  return {
    coupleTitle: `${wedding.groomName} 与 ${wedding.brideName}的婚礼`,
    groom: wedding.groomName,
    bride: wedding.brideName,
    date: new Intl.DateTimeFormat('en-GB', {
      ...options,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(date)
      .split('/')
      .reverse()
      .join('.'),
    weekday: new Intl.DateTimeFormat('zh-CN', { ...options, weekday: 'short' }).format(date),
    opening: new Intl.DateTimeFormat('en-GB', {
      ...options,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date),
    venue: wedding.venue.name,
    notice: isPreviewDestination(url) ? '预览 · 地址未就绪，请勿分发' : '诚邀相聚 · 长沙',
  };
}
