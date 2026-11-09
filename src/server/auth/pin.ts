import crypto from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

// Unambiguous alphabet (no 0/O, 1/I/L): 31 symbols, ~4.95 bits per character.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode(length: number): string {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** argon2id hash for PINs, recovery codes and pairing codes. */
export function hashSecret(secret: string): Promise<string> {
  return hash(secret);
}

export async function verifySecret(hashed: string, secret: string): Promise<boolean> {
  try {
    return await verify(hashed, secret);
  } catch {
    return false;
  }
}

/** 12 characters shown as XXXX-XXXX-XXXX. */
export function generateRecoveryCode(): string {
  const c = randomCode(12);
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`;
}

export function generatePairingCode(): string {
  return randomCode(8);
}

/** Normalize user-typed codes: uppercase, no separators or spaces. */
export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
