import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { MIGRATIONS_FOLDER, openDb } from '@/server/db/client';

/** Migration 0009 rebuilds meal_entry/meal_template_item: existing rows must survive unchanged (FR-033). */
describe('migration 0009 (recipes)', () => {
  it('keeps existing meal entries and template items with identical values', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'np-mig-'));
    // A copy of the migrations folder that stops at 0008 = a database created before this feature.
    const old = path.join(dir, 'migrations');
    fs.cpSync(MIGRATIONS_FOLDER, old, { recursive: true });
    fs.rmSync(path.join(old, '0009_recipes.sql'));
    const journalFile = path.join(old, 'meta', '_journal.json');
    const journal = JSON.parse(fs.readFileSync(journalFile, 'utf8'));
    journal.entries = journal.entries.filter((e: { tag: string }) => e.tag !== '0009_recipes');
    fs.writeFileSync(journalFile, JSON.stringify(journal));

    const h = openDb(path.join(dir, 'db.sqlite'));
    migrate(h.db, { migrationsFolder: old });
    const ts = '2026-11-01T12:00:00.000Z';
    const s = h.sqlite;
    s.prepare(`INSERT INTO profile (id, name, target_weight_kg, pin_hash, recovery_code_hash, created_at, updated_at) VALUES ('p1','Ana',80,'x','y',?,?)`).run(ts, ts);
    s.prepare(`INSERT INTO data_source (id, name, license, attribution_text) VALUES ('usda_fdc','USDA','CC0','USDA')`).run();
    s.prepare(`INSERT INTO food (id, data_source_id, source_food_id, name_es, category, preparation_state, current_version_id, created_at, updated_at) VALUES ('f1','usda_fdc','1','Arroz blanco, cocido','cereales','cooked','v1',?,?)`).run(ts, ts);
    s.prepare(`INSERT INTO food_version (id, food_id, version_no, basis, kcal, protein_g, carbs_g, fat_g, data_source_id, source_version, created_at) VALUES ('v1','f1',1,'g',130,2.7,28.2,0.3,'usda_fdc','sr',?)`).run(ts);
    s.prepare(`INSERT INTO meal (id, profile_id, local_date, occasion, created_at) VALUES ('m1','p1','2026-11-01','lunch',?)`).run(ts);
    s.prepare(
      `INSERT INTO meal_entry (id, profile_id, meal_id, local_date, food_id, food_version_id, quantity, unit, approximate, eaten_at,
        snap_name, snap_preparation_state, snap_data_source_id, snap_source_version, snap_basis, snap_kcal_per100, snap_protein_per100,
        snap_carbs_per100, snap_fat_per100, kcal, protein_g, carbs_g, fat_g, created_at, updated_at)
       VALUES ('e1','p1','m1','2026-11-01','f1','v1',150,'g',0,?, 'Arroz blanco, cocido','cooked','usda_fdc','sr','g',130,2.7,28.2,0.3,195,4.05,42.3,0.45,?,?)`,
    ).run(ts, ts, ts);
    s.prepare(`INSERT INTO meal_template (id, profile_id, name, created_at) VALUES ('t1','p1','Almuerzo',?)`).run(ts);
    s.prepare(`INSERT INTO meal_template_item (template_id, food_id, quantity, unit, position) VALUES ('t1','f1',150,'g',0)`).run();

    migrate(h.db, { migrationsFolder: MIGRATIONS_FOLDER });

    const e = s.prepare('SELECT * FROM meal_entry WHERE id = ?').get('e1') as Record<string, unknown>;
    expect(e).toMatchObject({
      kind: 'food',
      food_id: 'f1',
      food_version_id: 'v1',
      recipe_id: null,
      quantity: 150,
      unit: 'g',
      snap_kcal_per100: 130,
      snap_product_form: 'as_sold',
      kcal: 195,
      protein_g: 4.05,
    });
    expect(s.prepare('SELECT * FROM meal_template_item').all()).toEqual([
      { template_id: 't1', food_id: 'f1', recipe_id: null, portion_mode: null, portion_servings: null, quantity: 150, unit: 'g', position: 0 },
    ]);
    expect(s.prepare(`SELECT product_form FROM food WHERE id = 'f1'`).get()).toEqual({ product_form: 'as_sold' });
    expect(s.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    h.sqlite.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
