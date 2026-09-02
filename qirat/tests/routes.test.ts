import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  SEED_PASSWORD,
  as,
  closeAll,
  raw,
  resetTables,
  seedOrg,
  withTenant,
  type SeededOrg,
} from './helpers/db';
import { Session, startServer, type RunningServer } from './helpers/server';

/**
 * "A user in Org A cannot read Org B's data by any route."
 *
 * The database suites prove it at the query layer. This one proves it where the
 * brief actually asks: over HTTP, against the production build, with a real
 * signed session, by fetching every route the application exposes and searching
 * the bytes that come back for anything belonging to the other tenant.
 */

let server: RunningServer;
let orgA: SeededOrg;
let orgB: SeededOrg;

const ROUTES = [
  '/',
  '/app',
  '/app/payouts',
  '/app/conversations',
  '/app/settings',
  '/signin',
  '/signup',
  '/api/auth/session',
  '/api/auth/csrf',
  '/api/auth/providers',
  '/locale/ar?next=/app',
  '/locale/en?next=/app',
  '/does-not-exist',
];

beforeAll(async () => {
  await resetTables();
  orgA = await seedOrg('routesa');
  orgB = await seedOrg('routesb');
  // Put each Member on their own agency's first deal, so the Member page has
  // real content on it. A leak test against an empty page proves nothing.
  for (const org of [orgA, orgB]) {
    await withTenant(as(org, 'owner'), (tx) =>
      tx.execute(raw`
        insert into deal_assignments (org_id, deal_id, user_id, day_rate_minor, currency)
        values (${org.orgId}, ${org.dealId}, ${org.memberId}, 120000, 'EGP')`),
    );
  }
  server = await startServer();
}, 120_000);

afterAll(async () => {
  await server?.stop();
  await closeAll();
});

/** Every string that would identify org B if it leaked into a response. */
function orgBFingerprints(): string[] {
  return [
    orgB.orgId,
    orgB.name,
    orgB.slug,
    orgB.dealId,
    orgB.otherDealId,
    orgB.clientId,
    orgB.serviceId,
    orgB.memberId,
    orgB.managerId,
    orgB.ownerId,
    'routesb deal one',
    'routesb deal two',
    'routesb Client',
    orgB.emails.owner,
  ];
}

describe('signing in', () => {
  it('works for a seeded account', async () => {
    const session = new Session(server.baseUrl);
    expect(await session.signIn(orgA.emails.owner, SEED_PASSWORD)).toBe(true);
  });

  it('refuses the wrong password', async () => {
    const session = new Session(server.baseUrl);
    expect(await session.signIn(orgA.emails.owner, 'not-the-password')).toBe(false);
  });

  it('refuses an address that does not exist', async () => {
    const session = new Session(server.baseUrl);
    expect(await session.signIn('nobody@nowhere.test', SEED_PASSWORD)).toBe(false);
  });
});

describe('every route, signed in as org A', () => {
  for (const role of ['owner', 'account_manager', 'member', 'partner'] as const) {
    it(`leaks nothing about org B to a ${role}`, async () => {
      const session = new Session(server.baseUrl);
      const email =
        role === 'owner'
          ? orgA.emails.owner
          : role === 'account_manager'
            ? orgA.emails.manager
            : role === 'member'
              ? orgA.emails.member
              : orgA.emails.partner;
      expect(await session.signIn(email, SEED_PASSWORD)).toBe(true);

      for (const route of ROUTES) {
        const response = await session.fetch(route);
        const body = await response.text();
        for (const fingerprint of orgBFingerprints()) {
          expect(
            body.includes(fingerprint),
            `${role} received "${fingerprint}" from ${route}`,
          ).toBe(false);
        }
      }
    });
  }

  it('shows the owner their own agency, so the search above is not vacuous', async () => {
    const session = new Session(server.baseUrl);
    await session.signIn(orgA.emails.owner, SEED_PASSWORD);
    const body = await (await session.fetch('/app')).text();
    // If this fails, the leak test above proves nothing: it would pass on a
    // blank page too.
    expect(body).toContain('routesa deal one');
    expect(body).toContain('routesa Agency');
  });
});

describe('a Member over HTTP', () => {
  it('receives no financial figures anywhere', async () => {
    const session = new Session(server.baseUrl);
    await session.signIn(orgA.emails.member, SEED_PASSWORD);
    const body = await (await session.fetch('/app')).text();

    // The seeded deal is 80,000.00 EGP against 25,000.00 of cost. The Member is
    // on that deal and still may not be told any of it.
    for (const figure of ['80,000', '8000000', '25,000', '2500000']) {
      expect(body.includes(figure), `a member was shown "${figure}"`).toBe(false);
    }
    // The positive control, and it is a strong one now: the deal they are on is
    // named on the page, so the search above ran against real content.
    expect(body).toContain('routesa deal one');
    expect(body).toContain('Your work');
  });

  it('is shown the rate of their own assignment and no other', async () => {
    // Their own rate is a fact about them, like a Partner's own statement. A
    // colleague's rate is not, and neither is what the deal sells for.
    const session = new Session(server.baseUrl);
    await session.signIn(orgA.emails.member, SEED_PASSWORD);
    const body = await (await session.fetch('/app')).text();
    expect(body).toContain('1,200.00');
    expect(body).not.toContain('2,500.00');
  });

  it('cannot see another user in the organisation', async () => {
    const session = new Session(server.baseUrl);
    await session.signIn(orgA.emails.member, SEED_PASSWORD);
    const body = await (await session.fetch('/app')).text();
    expect(body).not.toContain(orgA.emails.manager);
    expect(body).not.toContain(orgA.managerId);
  });
});

describe('an Account Manager over HTTP', () => {
  it('sees their own deal and not a colleague’s', async () => {
    const session = new Session(server.baseUrl);
    await session.signIn(orgA.emails.manager, SEED_PASSWORD);
    const body = await (await session.fetch('/app')).text();
    expect(body).toContain('routesa deal one');
    expect(body).not.toContain('routesa deal two');
  });
});

describe('tampering with the session', () => {
  it('is rejected when the cookie is altered', async () => {
    const session = new Session(server.baseUrl);
    await session.signIn(orgA.emails.owner, SEED_PASSWORD);

    // Flip a character in the signed session token. The signature no longer
    // verifies, so the request is anonymous rather than authenticated as
    // somebody else.
    const cookieName = session.cookieHeader.includes('__Secure-authjs.session-token')
      ? '__Secure-authjs.session-token'
      : 'authjs.session-token';
    const current = session.cookieHeader
      .split('; ')
      .find((c) => c.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    expect(current, 'no session cookie was set').toBeTruthy();

    session.setCookie(cookieName, `${current!.slice(0, -4)}AAAA`);
    const response = await session.fetch('/app');
    expect([302, 307, 308]).toContain(response.status);
    expect(response.headers.get('location')).toContain('/signin');
  });

  it('cannot be pointed at another organisation with a header or a query string', async () => {
    const session = new Session(server.baseUrl);
    await session.signIn(orgA.emails.owner, SEED_PASSWORD);

    // Tenant context is read from the signed session and from nowhere else.
    // None of these inputs is consulted, and this asserts they still are not.
    //
    // The identifiers checked here are ones the attacker did not supply: an id
    // echoed back inside the URL it was sent in is reflection, not a leak, so
    // looking for it would fail this test for the wrong reason.
    const notSupplied = [
      orgB.name,
      orgB.dealId,
      orgB.clientId,
      orgB.serviceId,
      orgB.emails.owner,
      'routesb deal one',
      'routesb deal two',
      'routesb Client',
    ];
    const attempts = [
      `/app?orgId=${orgB.orgId}`,
      `/app?org=${orgB.slug}`,
      `/app?org_id=${orgB.orgId}&role=owner`,
    ];
    for (const attempt of attempts) {
      const body = await (
        await session.fetch(attempt, {
          headers: {
            'x-org-id': orgB.orgId,
            'x-qirat-org': orgB.slug,
            'x-role': 'owner',
          },
        })
      ).text();
      for (const fingerprint of notSupplied) {
        expect(body.includes(fingerprint), `${attempt} surfaced "${fingerprint}"`).toBe(false);
      }
      // The parameters were ignored, not honoured: org A's own page came back.
      expect(body, `${attempt} did not render org A's page`).toContain('routesa deal one');
    }
  });

  it('sends an anonymous visitor to sign in rather than to the app', async () => {
    const anonymous = new Session(server.baseUrl);
    const response = await anonymous.fetch('/app');
    expect([302, 307, 308]).toContain(response.status);
    expect(response.headers.get('location')).toContain('/signin');
  });
});

describe('switching language', () => {
  it('sets the cookie and redirects with a relative location', async () => {
    const session = new Session(server.baseUrl);
    const response = await session.fetch('/locale/ar?next=/app');

    expect(response.status).toBe(303);
    const location = response.headers.get('location');
    // Relative, not absolute. An absolute location built from the server's own
    // view of its host sends the browser to a different origin than the one
    // this Set-Cookie applies to, and the language silently fails to change.
    expect(location).toBe('/app');
    expect(location?.startsWith('http')).toBe(false);
    expect(response.headers.getSetCookie().join(';')).toContain('qirat_locale=ar');
  });

  it('serves the next document already in the right direction', async () => {
    const session = new Session(server.baseUrl);
    await session.fetch('/locale/ar?next=/signin');
    const html = await (await session.fetch('/signin')).text();

    // First byte, not after a client-side patch: no flash of the wrong
    // direction on a page full of Arabic.
    expect(html).toContain('lang="ar"');
    expect(html).toContain('dir="rtl"');

    await session.fetch('/locale/en?next=/signin');
    const back = await (await session.fetch('/signin')).text();
    expect(back).toContain('dir="ltr"');
  });

  it('refuses a locale it does not have', async () => {
    const session = new Session(server.baseUrl);
    expect((await session.fetch('/locale/fr')).status).toBe(404);
  });

  it('will not be turned into an open redirect', async () => {
    const session = new Session(server.baseUrl);
    for (const hostile of [
      '//evil.example',
      'https://evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
    ]) {
      const response = await session.fetch(`/locale/ar?next=${encodeURIComponent(hostile)}`);
      expect(response.headers.get('location'), `${hostile} was followed`).toBe('/app');
    }
  });
});

/**
 * Settings decide how every margin in the product is computed, so the screen is
 * the Owner's alone. The redirect is the courteous half of that; the column
 * grants on `organizations` are the half that actually holds.
 */
describe('the settings screen', () => {
  it('opens for the owner', async () => {
    const session = new Session(server.baseUrl);
    await session.signIn(orgA.emails.owner, SEED_PASSWORD);
    const response = await session.fetch('/app/settings');
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Registered for VAT');
  });

  for (const role of ['account_manager', 'member', 'partner'] as const) {
    it(`sends a ${role} away`, async () => {
      const session = new Session(server.baseUrl);
      const email =
        role === 'account_manager'
          ? orgA.emails.manager
          : role === 'member'
            ? orgA.emails.member
            : orgA.emails.partner;
      await session.signIn(email, SEED_PASSWORD);
      const response = await session.fetch('/app/settings');
      // Whatever happens, the agency's tax position is not on the page.
      const body = response.status === 200 ? await response.text() : '';
      expect(body).not.toContain('Registered for VAT');
      expect([200, 307, 308]).toContain(response.status);
      if (response.status !== 200) expect(response.headers.get('location')).toBe('/app');
    });
  }

  it('refuses an anonymous visitor', async () => {
    const anonymous = new Session(server.baseUrl);
    const response = await anonymous.fetch('/app/settings');
    expect(response.status).not.toBe(200);
  });
});

/**
 * The client relationship is the agency's, not the crew's.
 *
 * An account manager reaches it because they are the one making the calls. A
 * Member and a Partner are sent away, and the grants would refuse them anyway.
 */
describe('the conversations screen', () => {
  for (const role of ['owner', 'account_manager'] as const) {
    it(`opens for ${role}`, async () => {
      const session = new Session(server.baseUrl);
      const email = role === 'owner' ? orgA.emails.owner : orgA.emails.manager;
      await session.signIn(email, SEED_PASSWORD);
      const response = await session.fetch('/app/conversations');
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('Who to call');
    });
  }

  for (const role of ['member', 'partner'] as const) {
    it(`sends a ${role} away`, async () => {
      const session = new Session(server.baseUrl);
      const email = role === 'member' ? orgA.emails.member : orgA.emails.partner;
      await session.signIn(email, SEED_PASSWORD);
      const response = await session.fetch('/app/conversations');
      const body = response.status === 200 ? await response.text() : '';
      expect(body).not.toContain('Who to call');
      if (response.status !== 200) expect(response.headers.get('location')).toBe('/app');
    });
  }
});
