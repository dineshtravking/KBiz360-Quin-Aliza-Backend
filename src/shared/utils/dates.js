import { env } from '#config/env.js';

// Business dates are plain calendar days stored as 'YYYY-MM-DD' strings.
// They sort correctly as text and never shift because of time zones.

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: env.BUSINESS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const today = () => dayFormatter.format(new Date());

export const periodOf = (date) => date.slice(0, 7);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const monthName = (date) => MONTHS[Number(date.slice(5, 7)) - 1];

export function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function lastDayOfPeriod(period) {
  const [year, month] = period.split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${period}-${String(last).padStart(2, '0')}`;
}
