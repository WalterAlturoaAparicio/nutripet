/**
 * Weight history (FR-050–FR-052). Records are never overwritten. Past day energy snapshots are not
 * touched by weight edits (FR-019e); only today's in-progress snapshot is refreshed.
 */
import { and, asc, eq } from 'drizzle-orm';
import { movingAverageTrend, toTarget, trendChange } from '@/domain/weight';
import type { LocalDate } from '@/domain/types';
import { db } from '../../db/client';
import { profile, weightRecord } from '../../db/schema';
import { newId } from '../../db/ids';
import { nowIso } from '../../clock';
import { conflict, notFound } from '../../http/errors';
import { refreshTodaySnapshot } from '../day-energy/service';
import { assertNotFuture, profileToday } from '../profiles/time';
import { emitTracking } from '../events';

type WeightRow = typeof weightRecord.$inferSelect;

function all(profileId: string): WeightRow[] {
  return db().select().from(weightRecord).where(eq(weightRecord.profileId, profileId)).orderBy(asc(weightRecord.localDate), asc(weightRecord.createdAt)).all();
}

function own(profileId: string, id: string): WeightRow {
  const r = db().select().from(weightRecord).where(and(eq(weightRecord.id, id), eq(weightRecord.profileId, profileId))).get();
  if (!r) throw notFound('Registro de peso no encontrado.');
  return r;
}

const view = (r: WeightRow) => ({ id: r.id, date: r.localDate, weightKg: r.weightKg, note: r.note, createdAt: r.createdAt });

export function listWeights(profileId: string, range: { from?: LocalDate; to?: LocalDate } = {}) {
  const records = all(profileId);
  const trend = movingAverageTrend(records.map((r) => ({ id: r.id, localDate: r.localDate, weightKg: r.weightKg, createdAt: r.createdAt })));
  const targetKg = db().select({ t: profile.targetWeightKg }).from(profile).where(eq(profile.id, profileId)).get()!.t;
  const latest = records.reduce<WeightRow | null>(
    (best, r) => (!best || r.localDate > best.localDate || (r.localDate === best.localDate && r.createdAt > best.createdAt) ? r : best),
    null,
  );
  const lastTrend = trend.at(-1)?.trendKg ?? null;
  const inRange = (d: LocalDate) => (!range.from || d >= range.from) && (!range.to || d <= range.to);
  return {
    records: records.filter((r) => inRange(r.localDate)).map(view),
    trend: trend.filter((p) => inRange(p.date)),
    latestKg: latest?.weightKg ?? null,
    trendKg: lastTrend,
    targetKg,
    toTargetKg: lastTrend === null ? null : toTarget(lastTrend, targetKg),
    trendChange7dKg: trendChange(trend, 7),
  };
}

function afterChange(profileId: string, date: LocalDate, id: string, action: 'created' | 'updated' | 'deleted') {
  if (date === profileToday(profileId)) refreshTodaySnapshot(profileId);
  emitTracking({ profileId, date, kind: 'weight', recordId: id, action });
}

export function addWeight(profileId: string, input: { date: LocalDate; weightKg: number; note?: string | null }) {
  assertNotFuture(profileId, input.date);
  const ts = nowIso();
  const row: WeightRow = { id: newId(), profileId, localDate: input.date, weightKg: input.weightKg, note: input.note ?? null, createdAt: ts, updatedAt: ts };
  db().insert(weightRecord).values(row).run();
  afterChange(profileId, input.date, row.id, 'created');
  return view(row);
}

export function updateWeight(profileId: string, id: string, patch: { date?: LocalDate; weightKg?: number; note?: string | null }) {
  const cur = own(profileId, id);
  if (patch.date) assertNotFuture(profileId, patch.date);
  db()
    .update(weightRecord)
    .set({
      localDate: patch.date ?? cur.localDate,
      weightKg: patch.weightKg ?? cur.weightKg,
      note: patch.note !== undefined ? (patch.note ?? null) : cur.note,
      updatedAt: nowIso(),
    })
    .where(eq(weightRecord.id, id))
    .run();
  afterChange(profileId, patch.date ?? cur.localDate, id, 'updated');
  return view(own(profileId, id));
}

export function deleteWeight(profileId: string, id: string): void {
  const cur = own(profileId, id);
  if (all(profileId).length <= 1) {
    throw conflict('last_weight', 'Necesitas al menos un registro de peso para calcular tus estimaciones.');
  }
  db().delete(weightRecord).where(eq(weightRecord.id, id)).run();
  afterChange(profileId, cur.localDate, id, 'deleted');
}
