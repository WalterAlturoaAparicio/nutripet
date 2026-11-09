import { isoLocalDate } from '@/domain/dates';
import type { LocalDate } from '@/domain/types';

let fixedNow: Date | undefined;

/** Current instant. Tests may pin it with setNow(). */
export function now(): Date {
  return fixedNow ? new Date(fixedNow) : new Date();
}

export function nowIso(): string {
  return now().toISOString();
}

export function todayIn(timeZone: string): LocalDate {
  return isoLocalDate(now(), timeZone);
}

/** Test helper: pin the clock (undefined restores real time). */
export function setNow(instant: Date | string | undefined): void {
  fixedNow = instant === undefined ? undefined : new Date(instant);
}
