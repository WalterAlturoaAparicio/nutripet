/**
 * Extension points so later stories plug into profile creation without US1 depending on them.
 * Empty until US7 registers the pet hooks (I4).
 */
import type { Db } from '../../db/client';

export type ProfileCreatedHook = (d: Db, profileId: string, input: { petName?: string }) => void;
export type PetLookup = (profileIds: string[]) => Map<string, { petStage: string; petName: string }>;

const createdHooks: ProfileCreatedHook[] = [];
let petLookup: PetLookup | null = null;

export function onProfileCreated(hook: ProfileCreatedHook): void {
  if (!createdHooks.includes(hook)) createdHooks.push(hook);
}

export function runProfileCreatedHooks(d: Db, profileId: string, input: { petName?: string }): void {
  for (const h of createdHooks) h(d, profileId, input);
}

export function registerPetLookup(fn: PetLookup): void {
  petLookup = fn;
}

export function lookupPets(profileIds: string[]): ReturnType<PetLookup> {
  return petLookup ? petLookup(profileIds) : new Map();
}
