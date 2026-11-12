import { SCHEDULE, SCORING } from './config';

/** release_date 'YYYY-MM-DD' (a WIB calendar date) -> release instant at 04:00 WIB. */
export function releaseAtFor(releaseDate: string): Date {
  const [y, m, d] = releaseDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, SCHEDULE.releaseHourWib - SCHEDULE.wibOffsetHours, 0, 0));
}

export function closesAtFor(releaseAt: Date): Date {
  return new Date(releaseAt.getTime() + SCORING.windowMs);
}

/** Open window is [release_at, closes_at). The database is the source of truth; this mirrors it for UI and tests. */
export function isOpen(now: Date, releaseAt: Date, closesAt: Date): boolean {
  return now >= releaseAt && now < closesAt;
}

export function formatWib(date: Date, options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: SCHEDULE.timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(date);
}
