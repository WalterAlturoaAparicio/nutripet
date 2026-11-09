import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * End-to-end MVP flows (T118), in order, on a fresh database:
 * onboarding → second profile → lockout → enrollment → weighed breakfast (timed) → arepa gap →
 * activity & balance → calendar → profile switch isolation → no horizontal scroll at 360 px.
 */
test.describe.configure({ mode: 'serial' });

// One person's device across the whole sequence (device enrollment and cookies persist).
let context: BrowserContext;
let page: Page;
test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'es-CO', timezoneId: 'America/Bogota' });
  page = await context.newPage();
});
test.afterAll(async () => {
  await context.close();
});

async function onboard(page: Page, p: { name: string; female?: boolean; weight: string; target: string; goal: string; pin: string }) {
  await expect(page.getByRole('heading', { name: 'Bienvenido a NutriPet' })).toBeVisible();
  await page.getByLabel('Nombre').fill(p.name);
  await page.getByLabel('Fecha de nacimiento').fill('1996-11-05');
  await page.getByRole('radio', { name: p.female ? 'Mujer' : 'Hombre' }).click();
  await page.getByLabel('Estatura', { exact: true }).fill('170');
  await page.getByLabel('Peso actual').fill(p.weight);
  await page.getByLabel('Peso objetivo').fill(p.target);
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('radio', { name: p.goal }).click();
  await page.getByText('Moderado', { exact: true }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByText('Meta recomendada').first()).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel('PIN (4 a 6 dígitos)').fill(p.pin);
  await page.getByLabel('Repite el PIN').fill(p.pin);
  await page.getByRole('button', { name: 'Crear perfil' }).click();
  await expect(page.getByRole('heading', { name: 'Código de recuperación' })).toBeVisible();
  await page.getByRole('button', { name: 'Ya lo guardé' }).click();
  await expect(page.getByRole('heading', { name: `Hola, ${p.name}` })).toBeVisible();
}

async function typePin(page: Page, pin: string) {
  for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar' }).click();
}

async function login(page: Page, name: string, pin: string) {
  await page.goto('/select');
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await typePin(page, pin);
  await expect(page.getByRole('heading', { name: `Hola, ${name}` })).toBeVisible();
}

test('initial setup creates the first profile and enrolls this device', async () => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding/);
  await onboard(page, { name: 'Ana', weight: '58', target: '62', goal: 'Subir de peso', pin: '1234' });
  await expect(page.getByText('Te faltan')).toBeVisible();
});

test('a second profile is created from the signed-in session', async () => {
  await login(page, 'Ana', '1234');
  await page.goto('/onboarding');
  await onboard(page, { name: 'Bruno', female: false, weight: '88', target: '80', goal: 'Bajar de peso', pin: '5678' });
});

test('five wrong PINs lock the profile with a countdown', async () => {
  await page.goto('/select');
  await page.getByRole('button', { name: /Ana/ }).click();
  for (let i = 0; i < 4; i++) {
    await typePin(page, '0000');
    await expect(page.getByText('PIN incorrecto')).toBeVisible();
  }
  await typePin(page, '0000');
  await expect(page.getByText(/Demasiados intentos/)).toBeVisible();
});

test('a new device must enroll before seeing profiles', async ({ browser }) => {
  await login(page, 'Bruno', '5678');
  const code = await page.evaluate(async () => (await (await fetch('/api/v1/devices/pairing-code', { method: 'POST' })).json()).code as string);
  const other = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await other.newPage();
  await p2.goto('/select');
  await expect(p2).toHaveURL(/\/enroll/);
  await expect(p2.getByText('Bruno')).toHaveCount(0);
  await p2.getByLabel('Nombre del dispositivo').fill('Tablet');
  await p2.getByLabel('Código de emparejamiento').fill(code);
  await p2.getByRole('button', { name: 'Registrar' }).click();
  await expect(p2.getByRole('button', { name: /Bruno/ })).toBeVisible();
  await other.close();
});

test('log a weighed food item in under 20 seconds and see totals update', async () => {
  await login(page, 'Bruno', '5678');
  const started = Date.now();
  await page.getByRole('button', { name: /Agregar comida/ }).click();
  await page.getByRole('radio', { name: 'Desayuno' }).click();
  await page.getByLabel('Buscar alimento').fill('huevo');
  await page.getByRole('button', { name: /Huevo entero, cocido/ }).click();
  await page.getByLabel('Cantidad').fill('100');
  await page.getByRole('button', { name: /^Agregar a la comida ·/ }).click();
  await page.getByRole('button', { name: 'Guardar comida' }).click();
  await expect(page.getByLabel('Consumido').getByText('155 kcal', { exact: true })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(20_000);
});

test('homemade arepa is a documented gap: create it as a custom food and log 130 g', async () => {
  await login(page, 'Bruno', '5678');
  await page.goto('/diario');
  await page.getByRole('button', { name: '+ Agregar' }).first().click();
  await page.getByLabel('Buscar alimento').fill('arepa casera');
  await expect(page.getByText(/No hay un alimento verificado/)).toBeVisible();
  await page.getByRole('button', { name: 'Crear alimento personalizado' }).click();
  await expect(page).toHaveURL(/\/alimentos\/nuevo/);
  await page.getByLabel('Fuente de los valores').fill('Receta propia');
  await page.getByLabel('Energía (kcal)').fill('210');
  await page.getByLabel('Proteína (g)').fill('4.5');
  await page.getByLabel('Carbohidratos (g)').fill('42');
  await page.getByLabel('Grasa total (g)').fill('2.5');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page).toHaveURL(/\/diario/);
  await page.getByRole('button', { name: '+ Agregar' }).first().click();
  await page.getByLabel('Buscar alimento').fill('arepa casera');
  await page.getByRole('button', { name: /arepa casera/i }).click();
  await page.getByLabel('Cantidad').fill('130');
  await page.getByRole('button', { name: /^Agregar a la comida ·/ }).click();
  await page.getByRole('button', { name: 'Guardar comida' }).click();
  await expect(page.getByText('273 kcal').first()).toBeVisible();
});

test('builds a multi-food meal with a lemonade preparation and saves it at once', async () => {
  await login(page, 'Bruno', '5678');
  await page.goto('/diario');
  await expect(page.getByRole('heading', { name: 'Almuerzo' })).toBeVisible();
  await page.getByRole('button', { name: '+ Agregar' }).nth(2).click(); // Almuerzo
  const sheet = page.getByRole('dialog', { name: 'Registrar comida' });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel('Buscar alimento').fill('huevo');
  await sheet.getByRole('button', { name: /Huevo entero, cocido/ }).click();
  await sheet.getByLabel('Cantidad').fill('50');
  await sheet.getByRole('button', { name: /^Agregar a la comida ·/ }).click();
  // The first row stays while the next food is searched and added.
  await expect(sheet.getByRole('listitem').filter({ hasText: 'Huevo entero, cocido (duro)' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Nueva preparación' }).click();
  await sheet.getByLabel('Nombre de la preparación').fill('Bebida de prueba');
  await sheet.getByRole('button', { name: '+ Agua' }).click();
  await sheet.getByLabel('Cantidad').fill('300');
  await sheet.getByRole('button', { name: /^Agregar a la comida ·/ }).click();
  await expect(sheet.getByLabel('Preparación completa').getByText(/^0 kcal/)).toBeVisible();
  await sheet.getByRole('button', { name: 'Guardar y usar' }).click();
  await sheet.getByRole('button', { name: 'Agregar a la comida' }).click();
  await expect(sheet.getByLabel('Total de la comida')).toBeVisible();
  await sheet.getByRole('button', { name: 'Guardar comida' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText('Bebida de prueba')).toBeVisible();
});

test('an activity raises the estimated expenditure and balance', async () => {
  await login(page, 'Bruno', '5678');
  const expenditure = page.getByText(/kcal \(estimado\)/).first();
  const before = await expenditure.textContent();
  await page.getByRole('button', { name: /Agregar actividad/ }).click();
  await page.getByRole('button', { name: /Caminar/ }).click();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(expenditure).not.toHaveText(before ?? '');
  await expect(page.getByText(/déficit estimado|superávit estimado|mantenimiento estimado/)).toBeVisible();
});

test('the calendar shows day states and streak stats', async () => {
  await login(page, 'Bruno', '5678');
  await page.goto('/calendario');
  await expect(page.getByText('Racha actual')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Leyenda' })).toBeVisible();
  await expect(page.getByRole('button', { name: /: Comida parcial|: Día completo|: Comida completa/ }).first()).toBeVisible();
});

test('switching profile does not leave the previous data reachable with Back', async () => {
  await login(page, 'Bruno', '5678');
  await page.getByRole('button', { name: 'Menú' }).click();
  await page.getByRole('menuitem', { name: 'Cambiar perfil' }).click();
  await expect(page).toHaveURL(/\/select/);
  await page.goBack();
  await expect(page).toHaveURL(/\/select/);
  await expect(page.getByText('Hola, Bruno')).toHaveCount(0);
});

test('core screens have no horizontal scroll at 360 px', async () => {
  await page.setViewportSize({ width: 360, height: 780 });
  await login(page, 'Bruno', '5678');
  for (const path of ['/inicio', '/diario', '/actividad', '/calendario', '/progreso', '/alimentos', '/mascota', '/perfil']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
