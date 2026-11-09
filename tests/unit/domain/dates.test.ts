import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateRange,
  daysBetween,
  isFuture,
  isLocalDate,
  isoLocalDate,
  isValidTimeZone,
  monthDays,
} from '@/domain/dates';

describe('isoLocalDate', () => {
  it('uses the Bogotá day around UTC midnight', () => {
    // 2026-11-09 03:30 UTC is still 2026-11-08 22:30 in Bogotá (UTC−5).
    expect(isoLocalDate(new Date('2026-11-09T03:30:00Z'), 'America/Bogota')).toBe('2026-11-08');
    expect(isoLocalDate(new Date('2026-11-09T05:00:00Z'), 'America/Bogota')).toBe('2026-11-09');
  });

  it('respects other time zones', () => {
    // 23:30 UTC on 11-08 is already 11-09 in Madrid (UTC+1 in November).
    expect(isoLocalDate(new Date('2026-11-08T23:30:00Z'), 'Europe/Madrid')).toBe('2026-11-09');
  });
});

describe('date arithmetic', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-11-01', '2026-11-08')).toBe(7);
    expect(daysBetween('2026-11-08', '2026-11-01')).toBe(-7);
  });

  it('detects future dates', () => {
    expect(isFuture('2026-11-09', '2026-11-08')).toBe(true);
    expect(isFuture('2026-11-08', '2026-11-08')).toBe(false);
  });

  it('builds ranges', () => {
    expect(dateRange('2026-02-27', '2026-03-01')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
    expect(dateRange('2026-03-02', '2026-03-01')).toEqual([]);
  });
});

describe('monthDays', () => {
  it('handles month lengths and leap years', () => {
    expect(monthDays('2026-02')).toHaveLength(28);
    expect(monthDays('2028-02')).toHaveLength(29);
    expect(monthDays('2026-11')).toHaveLength(30);
    expect(monthDays('2026-12').at(-1)).toBe('2026-12-31');
  });
});

describe('validation helpers', () => {
  it('validates local dates', () => {
    expect(isLocalDate('2026-02-29')).toBe(false);
    expect(isLocalDate('2028-02-29')).toBe(true);
    expect(isLocalDate('2026-1-01')).toBe(false);
  });

  it('validates time zones', () => {
    expect(isValidTimeZone('America/Bogota')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});
