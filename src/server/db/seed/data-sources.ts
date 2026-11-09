import { dataSource } from '../schema';
import { registerSeeder } from './index';

export const DATA_SOURCES = [
  {
    id: 'usda_fdc',
    name: 'USDA FoodData Central (Foundation Foods, SR Legacy)',
    license: 'CC0 1.0 (dominio público)',
    attributionText: 'U.S. Department of Agriculture, Agricultural Research Service. FoodData Central. fdc.nal.usda.gov',
    url: 'https://fdc.nal.usda.gov/',
  },
  {
    id: 'usda_fndds',
    name: 'USDA FoodData Central (FNDDS, Survey Foods)',
    license: 'CC0 1.0 (dominio público)',
    attributionText:
      'U.S. Department of Agriculture, Agricultural Research Service. Food and Nutrient Database for Dietary Studies (FNDDS), FoodData Central. fdc.nal.usda.gov',
    url: 'https://fdc.nal.usda.gov/',
  },
  {
    id: 'tcac',
    name: 'Tabla de Composición de Alimentos Colombianos (ICBF)',
    license: 'Pendiente de verificación (no se usa hasta confirmar la licencia)',
    attributionText: 'Instituto Colombiano de Bienestar Familiar (ICBF). Tabla de Composición de Alimentos Colombianos.',
    url: 'https://www.icbf.gov.co/',
  },
  {
    id: 'off',
    name: 'Open Food Facts',
    license: 'Open Database License (ODbL) 1.0; contenidos DbCL 1.0',
    attributionText: 'Datos de Open Food Facts (contribuidores de Open Food Facts), bajo licencia ODbL 1.0. openfoodfacts.org',
    url: 'https://world.openfoodfacts.org/',
  },
  {
    id: 'reference',
    name: 'Valores de referencia de NutriPet',
    license: 'Datos de referencia (sin restricciones)',
    attributionText:
      'Registros básicos mantenidos por NutriPet con valores físicamente establecidos (p. ej., el agua no aporta energía ni macronutrientes).',
    url: null,
  },
  {
    id: 'user',
    name: 'Alimento creado por el usuario',
    license: 'Datos del usuario',
    attributionText: 'Valores ingresados por el usuario a partir de la fuente que indicó.',
    url: null,
  },
  {
    id: 'user_correction',
    name: 'Corrección del usuario',
    license: 'Datos del usuario',
    attributionText: 'Valores corregidos por el usuario para su propio perfil.',
    url: null,
  },
] as const;

registerSeeder({
  name: 'data-sources',
  run: (d) => {
    for (const s of DATA_SOURCES) {
      d.insert(dataSource)
        .values({ ...s })
        .onConflictDoUpdate({ target: dataSource.id, set: { name: s.name, license: s.license, attributionText: s.attributionText, url: s.url } })
        .run();
    }
  },
});
