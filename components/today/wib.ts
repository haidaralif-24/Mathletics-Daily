import { formatWib } from '@/lib/time';

/**
 * S-2: every time on this screen is shown in WIB, whatever the device
 * timezone says. `formatWib` already pins `Asia/Jakarta`; these two helpers
 * only pick the pieces the copy needs, so the wording stays identical
 * everywhere ("13 Nov 2026" and "04.00").
 */

const toDate = (value: Date | string): Date => (value instanceof Date ? value : new Date(value));

/** "13 Nov 2026" (id-ID, WIB). */
export function wibDate(value: Date | string): string {
  return formatWib(toDate(value), { timeStyle: undefined });
}

/** "04.00" — 24-hour WIB clock time, the way Indonesian schedules are written. */
export function wibTime(value: Date | string): string {
  return formatWib(toDate(value), {
    dateStyle: undefined,
    timeStyle: undefined,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "13 Nov 2026 pukul 04.00 WIB" — the S-3 sentence, minus its prefix. */
export function wibDateTime(value: Date | string): string {
  return `${wibDate(value)} pukul ${wibTime(value)} WIB`;
}
