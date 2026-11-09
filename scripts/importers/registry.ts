/**
 * Adapter registry (T138). Order = source priority for imports: usda_fdc → usda_fndds → off → tcac.
 * Adding a source = writing an adapter returning AdapterResult and registering it here (plus a data_source seed).
 */
import type { DataSourceId } from '../../src/server/db/schema/foods';
import type { AdapterResult } from './normalized';
import { loadUsda } from './usda';
import { loadOff } from './off';
import { loadTcac, tcacEnabled } from './tcac';

export interface SourceAdapter {
  sourceId: DataSourceId;
  enabled(): boolean;
  load(input?: string): AdapterResult;
}

export const ADAPTERS: SourceAdapter[] = [
  { sourceId: 'usda_fdc', enabled: () => true, load: (input) => loadUsda('usda_fdc', input) },
  { sourceId: 'usda_fndds', enabled: () => true, load: (input) => loadUsda('usda_fndds', input) },
  { sourceId: 'off', enabled: () => true, load: (input) => loadOff(input) },
  { sourceId: 'tcac', enabled: tcacEnabled, load: (input) => loadTcac(input) },
];

export function adapterFor(sourceId: string): SourceAdapter {
  const a = ADAPTERS.find((x) => x.sourceId === sourceId);
  if (!a) throw new Error(`Fuente desconocida: ${sourceId}. Opciones: ${ADAPTERS.map((x) => x.sourceId).join(', ')}`);
  return a;
}
