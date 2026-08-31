import { expect } from 'vitest';

/**
 * Drizzle wraps a driver error in "Failed query: ...", so the reason Postgres
 * gave — "permission denied for table deals" — is one or more `cause` links
 * down. Assertions here walk the whole chain, or they assert on the wrapper and
 * pass whatever actually went wrong.
 */
export function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current);
    parts.push(current.message);
    current = (current as { cause?: unknown }).cause;
  }
  return parts.join(' | ');
}

/** Assert a query is refused, and refused for the reason we expect. */
export async function expectRefused(work: Promise<unknown>, reason: RegExp): Promise<void> {
  let threw = false;
  try {
    await work;
  } catch (error) {
    threw = true;
    expect(describeError(error), 'refused, but not for the expected reason').toMatch(reason);
  }
  expect(threw, 'expected the database to refuse this, but it succeeded').toBe(true);
}
