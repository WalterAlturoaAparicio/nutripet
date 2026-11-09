/**
 * Operator PIN reset (T121): sets a new PIN typed at the terminal, rotates the recovery code, resets
 * both lockouts and ends the profile's sessions. Prints no profile data, only the new recovery code
 * to hand to the person.
 *
 *   pnpm admin:reset-pin --profile "<nombre>"
 */
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { eq, sql } from 'drizzle-orm';
import { prepareDatabase } from '../src/server/db/setup';
import { setDbHandle } from '../src/server/db/client';
import { profile, session } from '../src/server/db/schema';
import { generateRecoveryCode, hashSecret, normalizeCode } from '../src/server/auth/pin';

async function main() {
  const i = process.argv.indexOf('--profile');
  const name = i >= 0 ? process.argv[i + 1] : undefined;
  if (!name) {
    console.error('Uso: pnpm admin:reset-pin --profile "<nombre>"');
    process.exit(2);
  }
  const { handle } = prepareDatabase(process.env.DATABASE_PATH || './data/nutripet.db');
  setDbHandle(handle);
  const row = handle.db.select({ id: profile.id }).from(profile).where(sql`lower(${profile.name}) = lower(${name})`).get();
  if (!row) {
    console.error('Perfil no encontrado.');
    process.exit(1);
  }
  const rl = readline.createInterface({ input, output });
  const pin = (await rl.question('Nuevo PIN (4 a 6 dígitos): ')).trim();
  rl.close();
  if (!/^\d{4,6}$/.test(pin)) {
    console.error('El PIN debe tener entre 4 y 6 dígitos.');
    process.exit(1);
  }
  const recoveryCode = generateRecoveryCode();
  handle.db
    .update(profile)
    .set({
      pinHash: await hashSecret(pin),
      recoveryCodeHash: await hashSecret(normalizeCode(recoveryCode)),
      failedPinAttempts: 0,
      pinLockSeries: 0,
      lockedUntil: null,
      failedRecoveryAttempts: 0,
      recoveryLockSeries: 0,
      recoveryLockedUntil: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(profile.id, row.id))
    .run();
  handle.db.delete(session).where(eq(session.profileId, row.id)).run();
  console.log(`PIN actualizado. Nuevo código de recuperación: ${recoveryCode}`);
  handle.sqlite.close();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
