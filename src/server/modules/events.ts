/**
 * Synchronous in-process events so later stories (calendar, pet) react to tracking changes without
 * the journal, activity or weight modules depending on them.
 */
import type { LocalDate } from '@/domain/types';

export type TrackingKind = 'food_entry' | 'activity' | 'weight' | 'day_flags';

export interface TrackingEvent {
  profileId: string;
  date: LocalDate;
  kind: TrackingKind;
  recordId: string;
  action: 'created' | 'updated' | 'deleted';
}

type Listener = (e: TrackingEvent) => void;
const listeners: Listener[] = [];

export function onTracking(listener: Listener): void {
  if (!listeners.includes(listener)) listeners.push(listener);
}

export function emitTracking(e: TrackingEvent): void {
  for (const l of listeners) l(e);
}

/** Extensions that enrich the day summary (estimates in US3, status in US6, XP in US7). */
export type DaySummaryExtension<T> = (profileId: string, date: LocalDate, summary: T) => void;
const extensions: DaySummaryExtension<unknown>[] = [];

export function extendDaySummary<T>(ext: DaySummaryExtension<T>): void {
  if (!extensions.includes(ext as DaySummaryExtension<unknown>)) extensions.push(ext as DaySummaryExtension<unknown>);
}

export function applyDaySummaryExtensions<T>(profileId: string, date: LocalDate, summary: T): T {
  for (const ext of extensions) ext(profileId, date, summary);
  return summary;
}
