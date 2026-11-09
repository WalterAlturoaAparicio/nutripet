/** Applies migrations and idempotent seeds once when the Node server starts (also inside Docker). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { prepareDatabase } = await import('./server/db/setup');
  const { setDbHandle } = await import('./server/db/client');
  const { handle } = prepareDatabase(process.env.DATABASE_PATH || './data/nutripet.db');
  setDbHandle(handle);
}
