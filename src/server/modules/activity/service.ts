/**
 * Activity log (FR-040–FR-044). Net expenditure = (MET − 1) × kg × h using the weight frozen in the
 * day's energy snapshot; manual estimates replace it; "none" contributes 0 (but still counts as tracking).
 */
import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { activityNetKcal } from '@/domain/energy';
import type { Intensity, LocalDate } from '@/domain/types';
import { db } from '../../db/client';
import { activityEntry, activityType } from '../../db/schema';
import { newId } from '../../db/ids';
import { nowIso } from '../../clock';
import { ApiError, notFound } from '../../http/errors';
import type { CreateActivityInput, UpdateActivityInput } from '../../validation/activity';
import { ensureDaySnapshot } from '../day-energy/service';
import { assertNotFuture } from '../profiles/time';
import { emitTracking } from '../events';
import { getDaySummary } from '../journal/service';

type TypeRow = typeof activityType.$inferSelect;
export type ActivityRow = typeof activityEntry.$inferSelect;

export function listActivityTypes(profileId: string) {
  return db()
    .select()
    .from(activityType)
    .where(or(isNull(activityType.ownerProfileId), eq(activityType.ownerProfileId, profileId)))
    .orderBy(asc(activityType.ownerProfileId), asc(activityType.nameEs))
    .all()
    .map((t) => ({ ...t, isCustom: t.ownerProfileId !== null }));
}

export function createActivityType(profileId: string, input: { nameEs: string; metLight?: number | null; metModerate?: number | null; metVigorous?: number | null }) {
  const row: TypeRow = {
    id: newId(),
    ownerProfileId: profileId,
    nameEs: input.nameEs,
    icon: null,
    metLight: input.metLight ?? null,
    metModerate: input.metModerate ?? null,
    metVigorous: input.metVigorous ?? null,
    compendiumCode: null,
    createdAt: nowIso(),
  };
  db().insert(activityType).values(row).run();
  return { ...row, isCustom: true };
}

function visibleType(profileId: string, typeId: string): TypeRow {
  const t = db()
    .select()
    .from(activityType)
    .where(and(eq(activityType.id, typeId), or(isNull(activityType.ownerProfileId), eq(activityType.ownerProfileId, profileId))))
    .get();
  if (!t) throw notFound('Actividad no encontrada.');
  return t;
}

function metFor(t: TypeRow, intensity: Intensity | null | undefined): { met: number; intensity: Intensity } | null {
  const mets: Record<Intensity, number | null> = { light: t.metLight, moderate: t.metModerate, vigorous: t.metVigorous };
  const defined = (Object.keys(mets) as Intensity[]).filter((k) => mets[k] !== null);
  if (defined.length === 0) return null;
  if (!intensity) {
    if (defined.length > 1) {
      throw new ApiError('VALIDATION', undefined, { fields: { intensity: 'Elige la intensidad para calcular el gasto.' } });
    }
    return { met: mets[defined[0]!]!, intensity: defined[0]! };
  }
  const m = mets[intensity];
  if (m === null) throw new ApiError('VALIDATION', undefined, { fields: { intensity: 'No hay MET para esa intensidad.' } });
  return { met: m, intensity };
}

function estimate(
  profileId: string,
  date: LocalDate,
  t: TypeRow,
  v: { durationMin: number; intensity?: Intensity | null; estimateMethod: 'met' | 'manual' | 'none'; manualKcal?: number },
) {
  if (v.estimateMethod === 'none') return { metUsed: null, weightKgUsed: null, netKcal: 0, intensity: v.intensity ?? null };
  if (v.estimateMethod === 'manual') return { metUsed: null, weightKgUsed: null, netKcal: v.manualKcal ?? 0, intensity: v.intensity ?? null };
  const m = metFor(t, v.intensity);
  if (!m) {
    throw new ApiError('VALIDATION', 'Esta actividad no tiene MET. Usa tu propia estimación o "sin estimación".', {
      fields: { estimateMethod: 'Esta actividad no tiene MET.' },
    });
  }
  // The weight comes from the day's frozen snapshot, so backfilled days use the weight of that date.
  const weightKg = ensureDaySnapshot(profileId, date).weightKg;
  return { metUsed: m.met, weightKgUsed: weightKg, netKcal: activityNetKcal({ met: m.met, weightKg, durationMin: v.durationMin }), intensity: m.intensity };
}

function ownActivity(profileId: string, id: string): ActivityRow {
  const row = db().select().from(activityEntry).where(and(eq(activityEntry.id, id), eq(activityEntry.profileId, profileId))).get();
  if (!row) throw notFound('Actividad no encontrada.');
  return row;
}

export function addActivity(profileId: string, date: LocalDate, input: CreateActivityInput) {
  assertNotFuture(profileId, date);
  const t = visibleType(profileId, input.activityTypeId);
  ensureDaySnapshot(profileId, date);
  const e = estimate(profileId, date, t, input);
  const ts = nowIso();
  const row: ActivityRow = {
    id: newId(),
    profileId,
    activityTypeId: t.id,
    snapName: t.nameEs,
    localDate: date,
    durationMin: input.durationMin,
    intensity: e.intensity,
    estimateMethod: input.estimateMethod,
    metUsed: e.metUsed,
    weightKgUsed: e.weightKgUsed,
    netKcal: e.netKcal,
    note: input.note ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  db().insert(activityEntry).values(row).run();
  emitTracking({ profileId, date, kind: 'activity', recordId: row.id, action: 'created' });
  return { activity: toView(row), day: getDaySummary(profileId, date) };
}

export function updateActivity(profileId: string, id: string, patch: UpdateActivityInput) {
  const cur = ownActivity(profileId, id);
  const t = visibleType(profileId, patch.activityTypeId ?? cur.activityTypeId);
  const method = patch.estimateMethod ?? cur.estimateMethod;
  if (method === 'manual' && patch.manualKcal === undefined && cur.estimateMethod !== 'manual') {
    throw new ApiError('VALIDATION', undefined, { fields: { manualKcal: 'Ingresa las calorías estimadas.' } });
  }
  const v = {
    durationMin: patch.durationMin ?? cur.durationMin,
    intensity: patch.intensity !== undefined ? patch.intensity : cur.intensity,
    estimateMethod: method,
    manualKcal: patch.manualKcal ?? (cur.estimateMethod === 'manual' ? cur.netKcal : undefined),
  };
  const e = estimate(profileId, cur.localDate, t, v);
  db()
    .update(activityEntry)
    .set({
      activityTypeId: t.id,
      snapName: t.nameEs,
      durationMin: v.durationMin,
      intensity: e.intensity,
      estimateMethod: method,
      metUsed: e.metUsed,
      weightKgUsed: e.weightKgUsed,
      netKcal: e.netKcal,
      note: patch.note !== undefined ? (patch.note ?? null) : cur.note,
      updatedAt: nowIso(),
    })
    .where(eq(activityEntry.id, id))
    .run();
  emitTracking({ profileId, date: cur.localDate, kind: 'activity', recordId: id, action: 'updated' });
  return { activity: toView(ownActivity(profileId, id)), day: getDaySummary(profileId, cur.localDate) };
}

export function deleteActivity(profileId: string, id: string) {
  const cur = ownActivity(profileId, id);
  db().delete(activityEntry).where(eq(activityEntry.id, id)).run();
  emitTracking({ profileId, date: cur.localDate, kind: 'activity', recordId: id, action: 'deleted' });
  return { day: getDaySummary(profileId, cur.localDate) };
}

export function dayActivities(profileId: string, date: LocalDate): ActivityRow[] {
  return db()
    .select()
    .from(activityEntry)
    .where(and(eq(activityEntry.profileId, profileId), eq(activityEntry.localDate, date)))
    .orderBy(asc(activityEntry.createdAt))
    .all();
}

export function toView(r: ActivityRow) {
  return {
    id: r.id,
    activityTypeId: r.activityTypeId,
    name: r.snapName,
    localDate: r.localDate,
    durationMin: r.durationMin,
    intensity: r.intensity,
    estimateMethod: r.estimateMethod,
    metUsed: r.metUsed,
    weightKgUsed: r.weightKgUsed,
    netKcal: r.netKcal,
    note: r.note,
    isEstimate: true as const,
  };
}
