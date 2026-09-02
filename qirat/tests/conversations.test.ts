import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, closeAll, raw, resetTables, seedOrg, withTenant, type SeededOrg } from './helpers/db';
import { expectRefused } from './helpers/errors';
import { addContact, contacts, record, recent, schedule, silence, upcoming } from '../src/server/conversations';

/**
 * The client relationship.
 *
 * Shared inside the agency and invisible outside it — a different shape from
 * deals, where a manager sees only their own pipeline. The whole point of
 * writing a note down is that a colleague can read it while you are on a plane.
 */

let orgA: SeededOrg;
let orgB: SeededOrg;

beforeAll(async () => {
  await resetTables();
  orgA = await seedOrg('conva');
  orgB = await seedOrg('convb');
});
afterAll(async () => {
  await closeAll();
});

const at = (offsetDays: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString();
};

describe('scheduling and writing it down', () => {
  it('puts a call on the calendar and takes it off once it has happened', async () => {
    const ctx = as(orgA, 'account_manager');
    const id = await schedule(ctx, {
      clientId: orgA.clientId,
      kind: 'call',
      subject: 'Chase the signed SOW',
      happensAt: at(2),
    });

    expect((await upcoming(ctx)).map((c) => c.id)).toContain(id);
    expect((await recent(ctx)).map((c) => c.id)).not.toContain(id);

    await record(ctx, {
      id,
      state: 'happened',
      notes: 'Signed. Kickoff the week after next.',
      nextStep: 'Send the kickoff invite',
      nextStepOn: at(3).slice(0, 10),
    });

    // The same row, moved by a state rather than copied to another table.
    expect((await upcoming(ctx)).map((c) => c.id)).not.toContain(id);
    const logged = (await recent(ctx)).find((c) => c.id === id)!;
    expect(logged.notes).toContain('Signed');
    expect(logged.clientName).toBe('conva Client');
  });

  it('refuses a next step with no date, because that is a wish', async () => {
    const ctx = as(orgA, 'account_manager');
    const id = await schedule(ctx, { kind: 'call', subject: 'Intro call', happensAt: at(1) });
    await expect(
      record(ctx, { id, state: 'happened', notes: 'Went well', nextStep: 'Send a proposal' }),
    ).rejects.toThrow(/when/i);
  });

  it('shows a meeting whose time has passed without being marked', async () => {
    // Not hidden until somebody remembers it. That row is exactly the one
    // needing action, and a calendar that quietly drops it is the reason the
    // note never gets written.
    const ctx = as(orgA, 'owner');
    const id = await schedule(ctx, {
      clientId: orgA.clientId,
      kind: 'meeting',
      subject: 'Quarterly review',
      happensAt: at(-3),
    });
    expect((await recent(ctx)).map((c) => c.id)).toContain(id);
    expect((await upcoming(ctx)).map((c) => c.id)).not.toContain(id);
  });

  it('sets updated_at itself, so a note cannot lie about when it was touched', async () => {
    const ctx = as(orgA, 'owner');
    const id = await schedule(ctx, { kind: 'call', subject: 'A call', happensAt: at(1) });
    // Read as text: the driver's own date handling is not what is under test,
    // and a string comparison says exactly what the column holds.
    const read = () =>
      withTenant(ctx, (tx) =>
        tx.execute<{ [c: string]: unknown; updated_at: string }>(
          raw`select updated_at::text as updated_at from conversations where id = ${id}`,
        ),
      ).then((rows) => Array.from(rows)[0]!.updated_at);

    const before = await read();
    // The caller names a time in 2020. The trigger overwrites it with now().
    await withTenant(ctx, (tx) =>
      tx.execute(raw`
        update conversations set notes = 'later', updated_at = '2020-01-01T00:00:00Z'
        where id = ${id}`),
    );
    const after = await read();
    expect(after.startsWith('2020')).toBe(false);
    expect(after >= before).toBe(true);
  });
});

describe('the silence', () => {
  it('counts what happened and says nothing', async () => {
    const ctx = as(orgA, 'owner');
    const id = await schedule(ctx, { kind: 'call', subject: 'Unwritten call', happensAt: at(-1) });
    await record(ctx, { id, state: 'happened' });

    const before = await silence(ctx);
    expect(before.unwritten).toBeGreaterThan(0);

    await record(ctx, { id, state: 'happened', notes: 'They want a second option.' });
    const after = await silence(ctx);
    expect(after.unwritten).toBe(before.unwritten - 1);
  });

  it('counts a promise whose date has gone by', async () => {
    const ctx = as(orgA, 'owner');
    const id = await schedule(ctx, { kind: 'call', subject: 'Promised call', happensAt: at(-10) });
    await record(ctx, {
      id,
      state: 'happened',
      notes: 'Asked for costs.',
      nextStep: 'Send the costings',
      nextStepOn: at(-4).slice(0, 10),
    });
    expect((await silence(ctx)).overdue).toBeGreaterThan(0);
  });

  it('tells a client never spoken to apart from one gone quiet', async () => {
    const ctx = as(orgB, 'owner');
    // Org B has a seeded client and no conversations at all.
    const quiet = (await silence(ctx)).quietClients;
    expect(quiet.map((c) => c.name)).toContain('convb Client');
    // null, not a large number that looks like an estimate.
    expect(quiet.find((c) => c.name === 'convb Client')!.days).toBeNull();
  });
});

describe('the directory', () => {
  it('holds a person, their number, and how long since anybody called', async () => {
    const ctx = as(orgA, 'account_manager');
    await addContact(ctx, {
      clientId: orgA.clientId,
      name: 'Nadia Farouk',
      title: 'Brand lead',
      phone: '+20 100 555 0000',
      isPrimary: true,
    });
    const directory = await contacts(ctx);
    const nadia = directory.find((c) => c.name === 'Nadia Farouk')!;
    expect(nadia.phone).toBe('+20 100 555 0000');
    expect(nadia.isPrimary).toBe(true);
    // Nobody has called her yet, and that is null rather than zero.
    expect(nadia.lastSpokeDays).toBeNull();
  });
});

describe('who may see any of it', () => {
  it('is shared between the owner and the account managers', async () => {
    // Unlike deals. A note exists so a colleague can read it.
    const written = await recent(as(orgA, 'owner'));
    const seen = await recent(as(orgA, 'account_manager', orgA.otherManagerId));
    expect(seen.length).toBe(written.length);
    expect(seen.length).toBeGreaterThan(0);
  });

  it('is closed to a Member', async () => {
    // A freelancer does not need the client's mobile number.
    await expectRefused(
      withTenant(as(orgA, 'member'), (tx) => tx.execute(raw`select * from conversations`)),
      /permission denied/i,
    );
    await expectRefused(
      withTenant(as(orgA, 'member'), (tx) => tx.execute(raw`select phone from client_contacts`)),
      /permission denied/i,
    );
  });

  it('is closed to a Partner', async () => {
    // An investor does not need to know who was called on Tuesday.
    await expectRefused(
      withTenant(as(orgA, 'partner'), (tx) => tx.execute(raw`select * from conversations`)),
      /permission denied/i,
    );
    await expectRefused(
      withTenant(as(orgA, 'partner'), (tx) => tx.execute(raw`select * from client_contacts`)),
      /permission denied/i,
    );
  });

  it('does not cross organisations', async () => {
    const mine = await recent(as(orgA, 'owner'));
    const theirs = await recent(as(orgB, 'owner'));
    const subjects = new Set(theirs.map((c) => c.subject));
    for (const conversation of mine) {
      expect(subjects.has(conversation.subject), conversation.subject).toBe(false);
    }
    expect(mine.length).toBeGreaterThan(0);
  });

  it('refuses to attach a conversation to another organisation’s client', async () => {
    await expectRefused(
      withTenant(as(orgA, 'owner'), (tx) =>
        tx.execute(raw`
          insert into conversations (org_id, client_id, owner_user_id, kind, subject, happens_at)
          values (${orgA.orgId}, ${orgB.clientId}, ${orgA.ownerId}, 'call', 'Poaching', now())`),
      ),
      /foreign key|violates/i,
    );
  });
});
