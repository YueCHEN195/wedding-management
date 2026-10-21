import { wedding } from '@shared/wedding';
const date = new Date(wedding.date);
const format = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', ...options }).format(date);
export const weddingDisplay = {
  date: format({ year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', '.'),
  fullDate: format({ year: 'numeric', month: 'long', day: 'numeric' }),
  weekday: format({ weekday: 'long' }).replace('星期', '周'),
  opening: format({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
};
