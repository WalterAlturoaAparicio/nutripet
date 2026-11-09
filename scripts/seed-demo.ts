/**
 * Seeds two demo profiles ("Demo Ana" gain, "Demo Bruno" loss) with the 60-day timeline from
 * scripts/demo/seed.ts ending today. Requires an imported catalog (pnpm import:foods --all).
 *
 *   pnpm seed:demo        (refuses to run if the demo profiles already exist)
 */
import { isoLocalDate } from '../src/domain/dates';
import { prepareDatabase } from '../src/server/db/setup';
import { setDbHandle } from '../src/server/db/client';
import { setNow } from '../src/server/clock';
import { searchFoods } from '../src/server/modules/foods/service';
import { POST as createProfile } from '../src/app/api/v1/profiles/route';
import { demoStart, seedProfileTimeline } from './demo/seed';

const DEMO = [
  { name: 'Demo Ana', birthDate: '1996-11-05', sexForFormula: 'female', heightCm: 162, weightKg: 52, targetWeightKg: 56, goalType: 'gain', activityLevel: 'light', calorieAdjustmentKcal: 300, pin: '1111' },
  { name: 'Demo Bruno', birthDate: '1992-03-10', sexForFormula: 'male', heightCm: 178, weightKg: 88, targetWeightKg: 80, goalType: 'loss', activityLevel: 'moderate', calorieAdjustmentKcal: -400, pin: '2222' },
];

async function main() {
  process.env.SESSION_SECRET ||= 'demo-seed-session-secret-0123456789abcdef';
  const { handle } = prepareDatabase(process.env.DATABASE_PATH || './data/nutripet.db');
  setDbHandle(handle);
  const pick = (q: string) => {
    const f = searchFoods('__demo__', { q, limit: 1 }).items[0];
    if (!f) throw new Error(`No se encontró "${q}" en el catálogo. Ejecuta primero: pnpm import:foods --all`);
    return f.id;
  };
  const foods = { a: pick('huevo cocido'), b: pick('arroz cocido'), c: pick('avena') };
  const today = isoLocalDate(new Date(), 'America/Bogota');
  setNow(new Date(Date.parse(`${demoStart(today)}T12:00:00Z`)));

  let cookie = '';
  const ids: string[] = [];
  for (const p of DEMO) {
    const res = await createProfile(
      new Request('http://localhost/api/v1/profiles', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), 'x-forwarded-for': '127.0.0.1' },
        body: JSON.stringify({ ...p, setupToken: process.env.SETUP_TOKEN }),
      }),
      { params: Promise.resolve({}) },
    );
    const body = (await res.json()) as { profile?: { id: string }; error?: { message: string } };
    if (!res.ok || !body.profile) throw new Error(`No se pudo crear ${p.name}: ${body.error?.message ?? res.status}`);
    ids.push(body.profile.id);
    cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  }
  seedProfileTimeline(ids[0]!, today, foods, { settingsChangeOnDay: 30 });
  seedProfileTimeline(ids[1]!, today, foods);
  setNow(undefined);
  console.log(`Demo creada (${demoStart(today)} → ${today}). PIN: Demo Ana 1111, Demo Bruno 2222.`);
  handle.sqlite.close();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
