import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';

const requireFrom = createRequire(import.meta.url);

/**
 * Boots the production build and returns its base URL.
 *
 * Route-level tests run against `next start`, not a dev server: caching and
 * server actions behave differently between them, and the thing being proved
 * here is what ships.
 */
export interface RunningServer {
  baseUrl: string;
  port: number;
  stop: () => Promise<void>;
}

/**
 * Ask the OS for a port nobody is using.
 *
 * A hardcoded port is shared state between runs. One orphaned server and every
 * later run either fails to bind or — far worse — passes its readiness check
 * against the previous run's server and then asserts on stale data.
 */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      probe.close(() => (port > 0 ? resolve(port) : reject(new Error('No free port available'))));
    });
  });
}

export async function startServer(port?: number): Promise<RunningServer> {
  if (!existsSync('.next/BUILD_ID')) {
    throw new Error(
      'The route suite needs a production build. Run `npm run build` first (CI does this).',
    );
  }

  const listenOn = port ?? (await freePort());

  // Spawned as a direct node child rather than through npx: npx adds shell and
  // wrapper layers, and killing the wrapper orphans the server that actually
  // holds the port. `detached` puts it in its own process group so the whole
  // group can be signalled at once.
  const nextBin = requireFrom.resolve('next/dist/bin/next');
  const child: ChildProcess = spawn(process.execPath, [nextBin, 'start', '-p', String(listenOn)], {
    detached: true,
    env: {
      ...process.env,
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
      AUTH_SECRET: process.env.AUTH_SECRET ?? 'test-secret-for-route-suite-only',
      AUTH_TRUST_HOST: 'true',
      NODE_ENV: 'production',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const logs: string[] = [];
  child.stdout?.on('data', (chunk) => logs.push(String(chunk)));
  child.stderr?.on('data', (chunk) => logs.push(String(chunk)));

  const baseUrl = `http://127.0.0.1:${listenOn}`;
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early:\n${logs.join('') || '(no output)'}`);
    }
    try {
      // Bounded: an unbounded fetch that hangs never re-checks the deadline,
      // and the suite then dies on the outer hook timeout saying nothing useful.
      const response = await fetch(`${baseUrl}/signin`, {
        redirect: 'manual',
        signal: AbortSignal.timeout(3_000),
      });
      if (response.status > 0) {
        return { baseUrl, port: listenOn, stop: () => terminate(child) };
      }
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  await terminate(child);
  throw new Error(
    `Server did not become ready within 60s on port ${listenOn}.\n--- server output ---\n${
      logs.join('') || '(the server printed nothing)'
    }`,
  );
}

/** Signal the whole process group, then wait for it to actually be gone. */
async function terminate(child: ChildProcess): Promise<void> {
  const pid = child.pid;
  if (pid === undefined || child.exitCode !== null) return;

  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  const signal = (name: NodeJS.Signals) => {
    try {
      process.kill(-pid, name);
    } catch {
      try {
        child.kill(name);
      } catch {
        // Already gone.
      }
    }
  };

  signal('SIGTERM');
  const force = setTimeout(() => signal('SIGKILL'), 5_000);
  await exited;
  clearTimeout(force);
}

/** A cookie jar just large enough to hold a session across requests. */
export class Session {
  private readonly jar = new Map<string, string>();

  constructor(readonly baseUrl: string) {}

  get cookieHeader(): string {
    return [...this.jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  setCookie(name: string, value: string): void {
    this.jar.set(name, value);
  }

  async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetch(new URL(path, this.baseUrl), {
      ...init,
      redirect: 'manual',
      headers: {
        ...(init.headers ?? {}),
        ...(this.jar.size > 0 ? { cookie: this.cookieHeader } : {}),
      },
    });
    for (const header of response.headers.getSetCookie()) {
      const pair = header.split(';')[0];
      const index = pair?.indexOf('=') ?? -1;
      if (!pair || index < 1) continue;
      const name = pair.slice(0, index);
      const value = pair.slice(index + 1);
      if (value === '' || value === 'deleted') this.jar.delete(name);
      else this.jar.set(name, value);
    }
    return response;
  }

  /** Sign in the way a browser does: CSRF token, then the credentials callback. */
  async signIn(email: string, password: string): Promise<boolean> {
    const csrfResponse = await this.fetch('/api/auth/csrf');
    const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };

    await this.fetch('/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        email,
        password,
        csrfToken,
        callbackUrl: `${this.baseUrl}/app`,
      }).toString(),
    });

    const session = await this.fetch('/api/auth/session');
    const payload = (await session.json()) as { user?: { orgId?: string } };
    return Boolean(payload?.user?.orgId);
  }
}
