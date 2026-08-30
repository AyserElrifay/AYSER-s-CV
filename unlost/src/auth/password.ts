import {
  type ScryptOptions,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

// promisify drops the options overload, so the signature is restated here.
const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * Password hashing with scrypt from Node's standard library.
 *
 * scrypt rather than argon2id for one practical reason: argon2 needs a native
 * module, and a native module is a deployment failure waiting to happen on a
 * serverless host. scrypt is memory-hard, is in the standard library, and needs
 * no build step anywhere. The parameters below are stored in the hash string,
 * so they can be raised later without invalidating existing passwords.
 */
const PARAMS = { N: 1 << 15, r: 8, p: 1, keylen: 64 } as const;
const SALT_BYTES = 16;

export class PasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PasswordError';
  }
}

/** Minimum viable policy: length beats composition rules that push people to Passw0rd!. */
export const MIN_PASSWORD_LENGTH = 10;

export function assertPasswordAcceptable(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new PasswordError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters. Length is what makes it hard to guess.`,
    );
  }
  if (password.length > 1024) {
    throw new PasswordError('Password must be shorter than 1024 characters.');
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordAcceptable(password);
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(password.normalize('NFKC'), salt, PARAMS.keylen, {
    N: PARAMS.N,
    r: PARAMS.r,
    p: PARAMS.p,
    maxmem: 128 * PARAMS.N * PARAMS.r * 2,
  });
  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

/**
 * Verify, in constant time, and never throw on a malformed stored hash — a
 * corrupt record must read as "wrong password", not as a stack trace that tells
 * an attacker the account exists.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, n, r, p, saltB64, hashB64] = stored.split('$');
    if (scheme !== 'scrypt' || !n || !r || !p || !saltB64 || !hashB64) return false;

    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const derived = await scrypt(password.normalize('NFKC'), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 128 * Number(n) * Number(r) * 2,
    });

    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * Burn roughly the same time as a real verification when no such user exists.
 * Without this, sign-in answers "is this email registered?" by how fast it
 * refuses.
 */
export async function equaliseTiming(password: string): Promise<void> {
  await verifyPassword(
    password,
    `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${randomBytes(SALT_BYTES).toString(
      'base64',
    )}$${randomBytes(PARAMS.keylen).toString('base64')}`,
  );
}
