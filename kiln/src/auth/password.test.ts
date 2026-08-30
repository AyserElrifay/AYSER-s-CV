import { describe, expect, it } from 'vitest';
import {
  MIN_PASSWORD_LENGTH,
  PasswordError,
  assertPasswordAcceptable,
  equaliseTiming,
  hashPassword,
  verifyPassword,
} from './password';

describe('hashPassword', () => {
  it('produces a verifiable hash', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
  });

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(await verifyPassword('correct horse batteryy', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('salts, so the same password hashes differently every time', async () => {
    const a = await hashPassword('correct horse battery');
    const b = await hashPassword('correct horse battery');
    expect(a).not.toBe(b);
    expect(await verifyPassword('correct horse battery', a)).toBe(true);
    expect(await verifyPassword('correct horse battery', b)).toBe(true);
  });

  it('records its parameters so they can be raised later', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash.startsWith('scrypt$32768$8$1$')).toBe(true);
    expect(hash.split('$')).toHaveLength(6);
  });

  it('normalises unicode, so the same typed password always matches', async () => {
    // Composed vs decomposed forms of the same Arabic/accented text.
    const composed = 'passwordé-١٢٣';
    const decomposed = 'passwordé-١٢٣'.normalize('NFD');
    const hash = await hashPassword(composed);
    expect(await verifyPassword(decomposed, hash)).toBe(true);
  });

  it('handles long and non-Latin passwords', async () => {
    const arabic = 'كلمة-السر-الطويلة-جدا';
    expect(await verifyPassword(arabic, await hashPassword(arabic))).toBe(true);
    const long = 'x'.repeat(1000);
    expect(await verifyPassword(long, await hashPassword(long))).toBe(true);
  });
});

describe('the password policy', () => {
  it('requires length rather than punctuation theatre', () => {
    expect(() => assertPasswordAcceptable('x'.repeat(MIN_PASSWORD_LENGTH))).not.toThrow();
    expect(() => assertPasswordAcceptable('short')).toThrow(PasswordError);
    expect(() => assertPasswordAcceptable('x'.repeat(2000))).toThrow(PasswordError);
  });

  it('says what to do, not just what went wrong', () => {
    expect(() => assertPasswordAcceptable('short')).toThrow(/at least 10 characters/);
  });
});

describe('verifyPassword', () => {
  it('reads a malformed stored hash as a failure, not an exception', async () => {
    for (const bad of ['', 'nonsense', 'scrypt$only$three', 'bcrypt$1$2$3$4$5', '$$$$$']) {
      expect(await verifyPassword('anything', bad)).toBe(false);
    }
  });

  it('rejects a hash claiming an absurd work factor without hanging', async () => {
    expect(await verifyPassword('anything', 'scrypt$999999999$8$1$c2FsdA==$aGFzaA==')).toBe(false);
  });
});

describe('equaliseTiming', () => {
  it('completes, so an unknown email costs the same as a known one', async () => {
    await expect(equaliseTiming('anything')).resolves.toBeUndefined();
  });
});
