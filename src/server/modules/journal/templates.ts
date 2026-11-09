import { and, asc, eq } from 'drizzle-orm';
import type { LocalDate, Occasion } from '@/domain/types';
import { db, tx } from '../../db/client';
import { food, mealTemplate, mealTemplateItem } from '../../db/schema';
import { newId } from '../../db/ids';
import { nowIso } from '../../clock';
import { notFound } from '../../http/errors';
import { visibleFood } from '../foods/service';
import { addBatch, mealItems } from './service';

type Item = { foodId: string; quantity: number; unit: 'g' | 'ml' };

export function createTemplate(profileId: string, input: { name: string; fromMealId: string } | { name: string; items: Item[] }) {
  const items = 'fromMealId' in input ? mealItems(profileId, input.fromMealId) : input.items;
  if (items.length === 0) throw notFound('La comida está vacía.');
  for (const it of items) visibleFood(profileId, it.foodId);
  const id = newId();
  tx((d) => {
    d.insert(mealTemplate).values({ id, profileId, name: input.name, createdAt: nowIso() }).run();
    items.forEach((it, position) => d.insert(mealTemplateItem).values({ templateId: id, ...it, position }).run());
  });
  return getTemplate(profileId, id);
}

function ownTemplate(profileId: string, id: string) {
  const t = db().select().from(mealTemplate).where(and(eq(mealTemplate.id, id), eq(mealTemplate.profileId, profileId))).get();
  if (!t) throw notFound('Plantilla no encontrada.');
  return t;
}

export function getTemplate(profileId: string, id: string) {
  const t = ownTemplate(profileId, id);
  const items = db()
    .select({ foodId: mealTemplateItem.foodId, quantity: mealTemplateItem.quantity, unit: mealTemplateItem.unit, name: food.nameEs })
    .from(mealTemplateItem)
    .innerJoin(food, eq(food.id, mealTemplateItem.foodId))
    .where(eq(mealTemplateItem.templateId, id))
    .orderBy(asc(mealTemplateItem.position))
    .all();
  return { id: t.id, name: t.name, items };
}

export function listTemplates(profileId: string) {
  return db()
    .select({ id: mealTemplate.id })
    .from(mealTemplate)
    .where(eq(mealTemplate.profileId, profileId))
    .orderBy(asc(mealTemplate.name))
    .all()
    .map((t) => getTemplate(profileId, t.id));
}

export function deleteTemplate(profileId: string, id: string): void {
  ownTemplate(profileId, id);
  db().delete(mealTemplate).where(eq(mealTemplate.id, id)).run();
}

/** Applies all items in one action; entries snapshot each food's current/effective version (FR-035). */
export function applyTemplate(profileId: string, id: string, to: { date: LocalDate; occasion: Occasion; label?: string }) {
  const t = getTemplate(profileId, id);
  return addBatch(profileId, to.date, {
    occasion: to.occasion,
    label: to.label,
    items: t.items.map(({ foodId, quantity, unit }) => ({ foodId, quantity, unit })),
    confirm: true,
  });
}
