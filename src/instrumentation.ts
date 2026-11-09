/** Applies migrations and idempotent seeds once when the Node server starts (also inside Docker). */
export async function register() {
  // The imports must stay inside this `if`: Next also compiles this file for the Edge runtime, and
  // only a block guarded by the inlined NEXT_RUNTIME check is dropped from that bundle. An early
  // `return` is not, so better-sqlite3 (which needs `fs`) would be bundled for Edge and fail.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { prepareDatabase } = await import('./server/db/setup');
    const { setDbHandle } = await import('./server/db/client');
    const { handle } = prepareDatabase(process.env.DATABASE_PATH || './data/nutripet.db');
    setDbHandle(handle);
  }
}
