import { and, asc, eq } from 'drizzle-orm';
import type { LocalDate, Occasion } from '@/domain/types';
import { db, tx } from '../../db/client';
import { food, mealTemplate, mealTemplateItem, recipe } from '../../db/schema';
import { newId } from '../../db/ids';
import { nowIso } from '../../clock';
import { notFound } from '../../http/errors';
import type { MealItemInput, PortionInput } from '../../validation/journal';
import { visibleFood } from '../foods/service';
import { currentRecipeVersion } from '../recipes/service';
import { addBatch, mealItems } from './service';

export type TemplateItemView =
  | { kind: 'food'; foodId: string; quantity: number; unit: 'g' | 'ml'; name: string }
  | { kind: 'recipe'; recipeId: string; portion: PortionInput; name: string };

/** A template stores the combination of foods/quantities and preparation portions, not nutrient values. */
export function createTemplate(profileId: string, input: { name: string; fromMealId: string } | { name: string; items: MealItemInput[] }) {
  const items = 'fromMealId' in input ? mealItems(profileId, input.fromMealId) : input.items;
  if (items.length === 0) throw notFound('La comida está vacía.');
  for (const it of items) {
    if ('recipeId' in it) currentRecipeVersion(profileId, it.recipeId);
    else visibleFood(profileId, it.foodId);
  }
  const id = newId();
  tx((d) => {
    d.insert(mealTemplate).values({ id, profileId, name: input.name, createdAt: nowIso() }).run();
    items.forEach((it, position) => {
      const values =
        'recipeId' in it
          ? {
              foodId: null,
              recipeId: it.recipeId,
              portionMode: it.portion.mode,
              portionServings: it.portion.mode === 'servings' ? it.portion.servings : null,
              quantity: it.portion.mode === 'amount' ? it.portion.quantity : null,
              unit: it.portion.mode === 'amount' ? it.portion.unit : null,
            }
          : { foodId: it.foodId, recipeId: null, portionMode: null, portionServings: null, quantity: it.quantity, unit: it.unit };
      d.insert(mealTemplateItem).values({ templateId: id, ...values, position }).run();
    });
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
  const rows = db()
    .select({ item: mealTemplateItem, foodName: food.nameEs, recipeName: recipe.name })
    .from(mealTemplateItem)
    .leftJoin(food, eq(food.id, mealTemplateItem.foodId))
    .leftJoin(recipe, eq(recipe.id, mealTemplateItem.recipeId))
    .where(eq(mealTemplateItem.templateId, id))
    .orderBy(asc(mealTemplateItem.position))
    .all();
  const items: TemplateItemView[] = rows.map(({ item, foodName, recipeName }) => {
    if (item.recipeId) {
      const portion: PortionInput =
        item.portionMode === 'servings'
          ? { mode: 'servings', servings: item.portionServings! }
          : item.portionMode === 'amount'
            ? { mode: 'amount', quantity: item.quantity!, unit: item.unit! }
            : { mode: 'whole' };
      return { kind: 'recipe', recipeId: item.recipeId, portion, name: recipeName ?? '' };
    }
    return { kind: 'food', foodId: item.foodId!, quantity: item.quantity!, unit: item.unit!, name: foodName ?? '' };
  });
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

export const templateItemsAsInput = (items: TemplateItemView[]): MealItemInput[] =>
  items.map((it) => (it.kind === 'recipe' ? { recipeId: it.recipeId, portion: it.portion } : { foodId: it.foodId, quantity: it.quantity, unit: it.unit }));

/** Applies all items in one action; entries snapshot each food's/recipe's current version (FR-035). */
export function applyTemplate(profileId: string, id: string, to: { date: LocalDate; occasion: Occasion; label?: string }) {
  const t = getTemplate(profileId, id);
  return addBatch(profileId, to.date, { occasion: to.occasion, label: to.label, items: templateItemsAsInput(t.items), confirm: true });
}
