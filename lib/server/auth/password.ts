/**
 * Password hashing. Local only — Supabase Auth takes this over on migration.
 */

import bcrypt from "bcryptjs";

/** 12 rounds: ~250ms on a laptop. Slow enough to hurt brute force, fast enough for a login. */
const ROUNDS = 12;

export const PASSWORD_MIN_LENGTH = 8;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * A hash of nothing, compared against when the email does not exist, so a
 * login for an unknown account takes as long as one with a wrong password.
 * Without it, response time tells an attacker which emails are registered.
 */
export const TIMING_DECOY_HASH = bcrypt.hashSync("breadboard-timing-decoy", ROUNDS);
