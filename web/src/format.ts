import { BUSINESS } from '../../shared/domain.ts';
export const money = (cents: number) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
export const time = (stamp: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone: BUSINESS.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(stamp);
export const date = (stamp: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone: BUSINESS.timezone,
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(stamp);
export const dateTime = (stamp: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone: BUSINESS.timezone,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(stamp);
export const dayKey = (stamp: number) =>
  new Date(stamp).toLocaleDateString('en-CA', { timeZone: BUSINESS.timezone });
export const nextDays = () =>
  Array.from({ length: 7 }, (_, i) => {
    const stamp = Date.now() + i * 86400000;
    return {
      key: dayKey(stamp),
      label: i === 0 ? '今天' : i === 1 ? '明天' : date(stamp),
      short: new Intl.DateTimeFormat('zh-CN', {
        timeZone: BUSINESS.timezone,
        month: '2-digit',
        day: '2-digit',
      }).format(stamp),
    };
  });
export const seatLabel = (seat: string) => seat.replace(/^R(\d+)-C(\d+)$/, '$1排$2座');
export const countdown = (milliseconds: number) => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};
