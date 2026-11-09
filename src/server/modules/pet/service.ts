/**
 * Virtual cat (FR-070–FR-078). XP and treats are tied to their source records so deletions revoke
 * them; day-level rewards follow the day's completion state. XP never decreases for missed days or
 * target outcomes; the stage uses max_xp_reached and never decreases. Nothing here reads kcal or goal,
 * except message selection (FR-078).
 */
import { and, desc, eq, gt, inArray, isNull } from 'drizzle-orm';
import { addDays, dateRange } from '@/domain/dates';
import { effectiveSettings } from '@/domain/energy/settings';
import {
  activityBonusXp,
  applyMoodDecay,
  awardXp,
  feed,
  MILESTONE_REWARDS,
  milestonesReached,
  moodLabel,
  moodOnAction,
  nextStageXp,
  progressPct,
  stageFor,
  streakBonusXp,
  weightXpAllowed,
  type MilestoneId,
} from '@/domain/gamification';
import { messageKey, type MessageEvent } from '@/domain/gamification/messages';
import { computeStreaks, isCompleted } from '@/domain/tracking';
import { BACKFILL_WINDOW_DAYS, MOOD } from '@/domain/config';
import type { GoalType, LocalDate, XpSource } from '@/domain/types';
import { t } from '@/i18n/es';
import { db, type Db } from '../../db/client';
import { accessory, milestoneUnlock, pet, petAccessoryUnlock, treatEvent, xpEvent } from '../../db/schema';
import { newId } from '../../db/ids';
import { nowIso } from '../../clock';
import { ApiError, conflict, notFound } from '../../http/errors';
import type { TrackingEvent } from '../events';
import { dayInputs, statusFor, streakDays } from '../calendar/service';
import { settingsVersions } from '../day-energy/service';
import { profileToday } from '../profiles/time';

type PetRow = typeof pet.$inferSelect;
type CappedSource = Exclude<XpSource, 'milestone'>;

const dayRecord = (date: LocalDate) => `day:${date}`;

export function createPetForProfile(d: Db, profileId: string, input: { petName?: string }): void {
  const ts = nowIso();
  d.insert(pet)
    .values({ profileId, name: input.petName?.trim() || 'Michi', mood: MOOD.initial, moodUpdatedDate: ts.slice(0, 10), createdAt: ts })
    .onConflictDoNothing()
    .run();
}

function getPetRow(profileId: string): PetRow {
  let row = db().select().from(pet).where(eq(pet.profileId, profileId)).get();
  if (!row) {
    createPetForProfile(db(), profileId, {});
    row = db().select().from(pet).where(eq(pet.profileId, profileId)).get();
  }
  if (!row) throw notFound();
  return row;
}

function goalOf(profileId: string): GoalType {
  return effectiveSettings(settingsVersions(profileId), profileToday(profileId)).goalType;
}

function activeEvents(profileId: string, source: XpSource, loggedDate: LocalDate, excludeRecord?: string) {
  return db()
    .select({ source: xpEvent.source, amount: xpEvent.amount, sourceRecordId: xpEvent.sourceRecordId })
    .from(xpEvent)
    .where(and(eq(xpEvent.profileId, profileId), eq(xpEvent.source, source), eq(xpEvent.loggedDate, loggedDate), isNull(xpEvent.revokedAt)))
    .all()
    .filter((e) => e.sourceRecordId !== excludeRecord);
}

/** Awards (or re-activates) the XP event for a record, within caps and the backfill window. */
function award(profileId: string, source: CappedSource, recordId: string, loggedDate: LocalDate, amount?: number): void {
  const existing = db()
    .select()
    .from(xpEvent)
    .where(and(eq(xpEvent.profileId, profileId), eq(xpEvent.source, source), eq(xpEvent.sourceRecordId, recordId)))
    .get();
  if (existing && !existing.revokedAt) return;
  const granted = awardXp(activeEvents(profileId, source, loggedDate, recordId), { source, loggedDate, amount }, profileToday(profileId));
  if (!granted) return;
  if (existing) {
    db().update(xpEvent).set({ revokedAt: null, amount: granted, createdAt: nowIso() }).where(eq(xpEvent.id, existing.id)).run();
  } else {
    db().insert(xpEvent).values({ id: newId(), profileId, source, sourceRecordId: recordId, loggedDate, amount: granted, createdAt: nowIso() }).run();
  }
}

function revoke(profileId: string, source: XpSource, recordId: string): void {
  db()
    .update(xpEvent)
    .set({ revokedAt: nowIso() })
    .where(and(eq(xpEvent.profileId, profileId), eq(xpEvent.source, source), eq(xpEvent.sourceRecordId, recordId), isNull(xpEvent.revokedAt)))
    .run();
}

function inWindow(profileId: string, date: LocalDate): boolean {
  const today = profileToday(profileId);
  return date >= addDays(today, -BACKFILL_WINDOW_DAYS) && date <= today;
}

function awardTreat(profileId: string, kind: 'food_day' | 'milestone', recordId: string, loggedDate: LocalDate, amount: number): void {
  const existing = db()
    .select()
    .from(treatEvent)
    .where(and(eq(treatEvent.profileId, profileId), eq(treatEvent.kind, kind), eq(treatEvent.sourceRecordId, recordId)))
    .get();
  if (existing && !existing.revokedAt) return;
  if (existing) db().update(treatEvent).set({ revokedAt: null }).where(eq(treatEvent.id, existing.id)).run();
  else db().insert(treatEvent).values({ id: newId(), profileId, kind, sourceRecordId: recordId, loggedDate, amount, createdAt: nowIso() }).run();
  const p = getPetRow(profileId);
  db().update(pet).set({ treats: p.treats + amount }).where(eq(pet.profileId, profileId)).run();
}

/** A revoked treat is removed only if still unspent: the balance never goes below 0. */
function revokeTreat(profileId: string, recordId: string): void {
  const e = db()
    .select()
    .from(treatEvent)
    .where(and(eq(treatEvent.profileId, profileId), eq(treatEvent.kind, 'food_day'), eq(treatEvent.sourceRecordId, recordId), isNull(treatEvent.revokedAt)))
    .get();
  if (!e) return;
  db().update(treatEvent).set({ revokedAt: nowIso() }).where(eq(treatEvent.id, e.id)).run();
  const p = getPetRow(profileId);
  db().update(pet).set({ treats: Math.max(0, p.treats - e.amount) }).where(eq(pet.profileId, profileId)).run();
}

/** Day-level rewards follow the day's state: food_day, activity bonus, streak bonus and the treat. */
function reconcileDay(profileId: string, date: LocalDate): void {
  const { status, row } = statusFor(profileId, date);
  const rec = dayRecord(date);
  if (!isCompleted(status)) {
    for (const s of ['food_day', 'activity_bonus', 'streak'] as const) revoke(profileId, s, rec);
    revokeTreat(profileId, rec);
    return;
  }
  const canAward = inWindow(profileId, date);
  if (canAward) award(profileId, 'food_day', rec, date);
  if (activityBonusXp(status, row?.activityCount ?? 0) > 0) {
    if (canAward) award(profileId, 'activity_bonus', rec, date);
  } else revoke(profileId, 'activity_bonus', rec);
  const days = streakDays(profileId);
  const day = days.find((d) => d.date === date);
  const streak = computeStreaks(days, profileToday(profileId)).streakOn[date] ?? 0;
  const bonus = day?.rewardEligible ? streakBonusXp(streak) : 0;
  if (bonus > 0 && canAward) award(profileId, 'streak', rec, date, bonus);
  if (canAward) awardTreat(profileId, 'food_day', rec, date, 1);
}

function weightEligible(profileId: string, date: LocalDate): boolean {
  const others = db()
    .select({ d: xpEvent.loggedDate })
    .from(xpEvent)
    .where(and(eq(xpEvent.profileId, profileId), eq(xpEvent.source, 'weight'), isNull(xpEvent.revokedAt)))
    .all();
  return others.every((o) => weightXpAllowed(o.d, date));
}

function refreshTotals(profileId: string): PetRow {
  const p = getPetRow(profileId);
  const total = db()
    .select({ amount: xpEvent.amount })
    .from(xpEvent)
    .where(and(eq(xpEvent.profileId, profileId), isNull(xpEvent.revokedAt)))
    .all()
    .reduce((s, e) => s + e.amount, 0);
  const maxXp = Math.max(p.maxXpReached, total);
  db().update(pet).set({ xpTotal: total, maxXpReached: maxXp, stage: stageFor(maxXp) }).where(eq(pet.profileId, profileId)).run();
  return getPetRow(profileId);
}

/** Unlocks reached milestones once (never removed): XP, treats and accessories identical for all goals. */
function checkMilestones(profileId: string): void {
  for (let guard = 0; guard < 5; guard++) {
    const p = refreshTotals(profileId);
    const days = streakDays(profileId);
    const st = computeStreaks(days, profileToday(profileId));
    const eligible = new Set(days.filter((d) => d.rewardEligible).map((d) => d.date));
    const bestEligibleStreak = Math.max(0, ...Object.entries(st.streakOn).filter(([d]) => eligible.has(d)).map(([, n]) => n));
    const unlocked = new Set(db().select({ id: milestoneUnlock.milestoneId }).from(milestoneUnlock).where(eq(milestoneUnlock.profileId, profileId)).all().map((r) => r.id));
    const fresh = milestonesReached({ bestEligibleStreak, eligibleCompletedDays: st.eligibleCompletedDays, maxXp: p.maxXpReached }).filter((m) => !unlocked.has(m));
    if (fresh.length === 0) return;
    const today = profileToday(profileId);
    for (const m of fresh) {
      const r = MILESTONE_REWARDS[m];
      db().insert(milestoneUnlock).values({ profileId, milestoneId: m, unlockedAt: nowIso(), loggedDate: today }).onConflictDoNothing().run();
      if (r.xp > 0) db().insert(xpEvent).values({ id: newId(), profileId, source: 'milestone', sourceRecordId: m, loggedDate: today, amount: r.xp, createdAt: nowIso() }).onConflictDoNothing().run();
      if (r.treats > 0) awardTreat(profileId, 'milestone', m, today, r.treats);
      if (r.accessory) db().insert(petAccessoryUnlock).values({ profileId, accessoryId: r.accessory, unlockedAt: nowIso() }).onConflictDoNothing().run();
    }
  }
}

/** Mood drops mildly for fully missed days (floor 30), applied lazily when the pet is read or touched. */
function applyDecay(profileId: string): PetRow {
  const p = getPetRow(profileId);
  const today = profileToday(profileId);
  if (p.moodUpdatedDate >= today) return p;
  const between = dateRange(addDays(p.moodUpdatedDate, 1), addDays(today, -1));
  const recorded = dayInputs(profileId, between[0] ?? today, between.at(-1) ?? today);
  const missed = between.filter((d) => {
    const r = recorded.get(d);
    return !r || (r.foodEntryCount === 0 && r.activityCount === 0);
  }).length;
  db().update(pet).set({ mood: applyMoodDecay(p.mood, missed), moodUpdatedDate: today }).where(eq(pet.profileId, profileId)).run();
  return getPetRow(profileId);
}

export function onTrackingEvent(e: TrackingEvent): void {
  applyDecay(e.profileId);
  if (e.kind === 'food_entry' || e.kind === 'activity' || e.kind === 'weight') {
    const source: CappedSource = e.kind;
    if (e.action === 'created') {
      if (source !== 'weight' || weightEligible(e.profileId, e.date)) award(e.profileId, source, e.recordId, e.date);
    } else if (e.action === 'deleted') {
      revoke(e.profileId, source, e.recordId);
    }
  }
  reconcileDay(e.profileId, e.date);
  if (e.action !== 'deleted') {
    const p = getPetRow(e.profileId);
    db().update(pet).set({ mood: moodOnAction(p.mood) }).where(eq(pet.profileId, e.profileId)).run();
  }
  checkMilestones(e.profileId);
}

export function xpAwardedFor(profileId: string, date: LocalDate): { source: string; amount: number }[] {
  const rows = db()
    .select({ source: xpEvent.source, amount: xpEvent.amount })
    .from(xpEvent)
    .where(and(eq(xpEvent.profileId, profileId), eq(xpEvent.loggedDate, date), isNull(xpEvent.revokedAt)))
    .all();
  const by = new Map<string, number>();
  for (const r of rows) by.set(r.source, (by.get(r.source) ?? 0) + r.amount);
  return [...by.entries()].map(([source, amount]) => ({ source, amount }));
}

function message(event: MessageEvent, goal: GoalType) {
  const key = messageKey(event, goal);
  return { key, text: t(key) };
}

export function getPet(profileId: string) {
  const p = applyDecay(profileId);
  const goal = goalOf(profileId);
  const today = profileToday(profileId);
  const unlockedAcc = new Set(db().select({ id: petAccessoryUnlock.accessoryId }).from(petAccessoryUnlock).where(eq(petAccessoryUnlock.profileId, profileId)).all().map((r) => r.id));
  const equipped = new Set(JSON.parse(p.equippedAccessoryIds) as string[]);
  const milestones = db().select().from(milestoneUnlock).where(eq(milestoneUnlock.profileId, profileId)).orderBy(desc(milestoneUnlock.unlockedAt)).all();
  const latestToday = milestones.find((m) => m.loggedDate === today);
  const recent = dayInputs(profileId, addDays(today, -1), today);
  const away = p.xpTotal > 0 && recent.size === 0;
  const event: MessageEvent = latestToday
    ? (latestToday.milestoneId as MilestoneId)
    : p.mood < 50 || away
      ? 'missed_you'
      : p.xpTotal === 0
        ? 'welcome'
        : isCompleted(statusFor(profileId, today).status)
          ? 'food_day_completed'
          : 'daily';
  return {
    name: p.name,
    stage: p.stage,
    xpTotal: p.xpTotal,
    maxXpReached: p.maxXpReached,
    nextStageXp: nextStageXp(p.maxXpReached),
    progressPct: progressPct(p.maxXpReached),
    mood: p.mood,
    moodLabel: moodLabel(p.mood),
    treats: p.treats,
    message: message(event, goal),
    accessories: db()
      .select()
      .from(accessory)
      .all()
      .map((a) => ({ id: a.id, nameEs: a.nameEs, unlocked: unlockedAcc.has(a.id), equipped: equipped.has(a.id) && unlockedAcc.has(a.id) })),
    recentMilestones: milestones.slice(0, 10).map((m) => ({ id: m.milestoneId, unlockedAt: m.unlockedAt, message: message(m.milestoneId as MessageEvent, goal) })),
  };
}

export function updatePet(profileId: string, patch: { name?: string; equippedAccessoryIds?: string[] }) {
  getPetRow(profileId);
  const values: Partial<PetRow> = {};
  if (patch.name !== undefined) values.name = patch.name;
  if (patch.equippedAccessoryIds) {
    const unlocked = db()
      .select({ id: petAccessoryUnlock.accessoryId })
      .from(petAccessoryUnlock)
      .where(and(eq(petAccessoryUnlock.profileId, profileId), inArray(petAccessoryUnlock.accessoryId, patch.equippedAccessoryIds)))
      .all()
      .map((r) => r.id);
    if (unlocked.length !== new Set(patch.equippedAccessoryIds).size) {
      throw new ApiError('VALIDATION', 'Ese accesorio aún está bloqueado.', { fields: { equippedAccessoryIds: 'Accesorio bloqueado.' } });
    }
    values.equippedAccessoryIds = JSON.stringify([...new Set(unlocked)]);
  }
  if (Object.keys(values).length) db().update(pet).set(values).where(eq(pet.profileId, profileId)).run();
  return getPet(profileId);
}

export function feedPet(profileId: string) {
  const p = applyDecay(profileId);
  let next: { treats: number; mood: number };
  try {
    next = feed({ treats: p.treats, mood: p.mood });
  } catch {
    throw conflict('no_treats', t('pet.noTreats'));
  }
  db().update(pet).set(next).where(and(eq(pet.profileId, profileId), gt(pet.treats, 0))).run();
  return { ...getPet(profileId), message: message('feed', goalOf(profileId)) };
}

export function petsFor(profileIds: string[]): Map<string, { petStage: string; petName: string }> {
  if (profileIds.length === 0) return new Map();
  return new Map(
    db()
      .select({ id: pet.profileId, stage: pet.stage, name: pet.name })
      .from(pet)
      .where(inArray(pet.profileId, profileIds))
      .all()
      .map((r) => [r.id, { petStage: r.stage, petName: r.name }]),
  );
}

