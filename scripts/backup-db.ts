/**
 * Consistent SQLite backup with VACUUM INTO, keeping the 14 most recent copies (T120).
 *
 *   pnpm backup:db            → data/backups/nutripet-YYYY-MM-DD.db
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const KEEP = 14;

function main() {
  const source = process.env.DATABASE_PATH || './data/nutripet.db';
  const dir = path.resolve(process.env.BACKUP_DIR || 'data/backups');
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, `nutripet-${new Date().toISOString().slice(0, 10)}.db`);
  if (fs.existsSync(target)) fs.rmSync(target);
  const db = new Database(source, { readonly: true });
  db.prepare('VACUUM INTO ?').run(target);
  db.close();
  const old = fs
    .readdirSync(dir)
    .filter((f) => /^nutripet-\d{4}-\d{2}-\d{2}\.db$/.test(f))
    .sort()
    .reverse()
    .slice(KEEP);
  for (const f of old) fs.rmSync(path.join(dir, f));
  console.log(`Copia: ${path.relative(process.cwd(), target)} (${old.length} antiguas eliminadas)`);
}

main();
