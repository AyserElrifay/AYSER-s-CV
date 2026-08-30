import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
// Imported so the module-augmentation block below can resolve it.
import type {} from 'next-auth/jwt';
import { findLoginCandidates } from '@/db/client';
import { type AppRole } from '@/db/roles';
import { equaliseTiming, verifyPassword } from './password';

/**
 * Email and password, self-hosted. No third party holds the identities, and
 * nothing depends on an email arriving — which matters in a market where email
 * is where work goes to be ignored.
 *
 * The session carries org and role because they are what the database needs to
 * establish tenant context. They are written once, at sign-in, from a verified
 * password, and never from anything the client sends.
 */

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      orgId: string;
      orgSlug: string;
      orgName: string;
      role: AppRole;
      locale: 'en' | 'ar';
    };
  }
  interface User {
    id?: string;
    orgId: string;
    orgSlug: string;
    orgName: string;
    role: AppRole;
    locale: 'en' | 'ar';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid: string;
    orgId: string;
    orgSlug: string;
    orgName: string;
    role: AppRole;
    locale: 'en' | 'ar';
  }
}

export const AMBIGUOUS_ACCOUNT = 'AMBIGUOUS_ACCOUNT';

export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 12 },
  pages: { signIn: '/signin' },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        // Only needed when one address belongs to more than one agency.
        workspace: { label: 'Workspace', type: 'text' },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email.trim() : '';
        const password = typeof credentials?.password === 'string' ? credentials.password : '';
        const workspace =
          typeof credentials?.workspace === 'string' ? credentials.workspace.trim() : '';
        if (!email || !password) return null;

        const candidates = await findLoginCandidates(email);
        if (candidates.length === 0) {
          // Spend the same time as a real verification, so the response does not
          // answer "is this address registered?" by how fast it refuses.
          await equaliseTiming(password);
          return null;
        }

        const scoped = workspace
          ? candidates.filter((c) => c.orgSlug === workspace)
          : candidates;

        const matched: typeof candidates = [];
        for (const candidate of scoped) {
          if (await verifyPassword(password, candidate.passwordHash)) matched.push(candidate);
        }
        if (matched.length === 0) return null;
        if (matched.length > 1) throw new Error(AMBIGUOUS_ACCOUNT);

        const user = matched[0]!;
        return {
          id: user.userId,
          email,
          name: user.userName,
          orgId: user.orgId,
          orgSlug: user.orgSlug,
          orgName: user.orgName,
          role: user.userRole,
          locale: user.locale === 'ar' ? 'ar' : 'en',
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id ?? '';
        token.orgId = user.orgId;
        token.orgSlug = user.orgSlug;
        token.orgName = user.orgName;
        token.role = user.role;
        token.locale = user.locale;
      }
      return token;
    },
    session({ session, token }) {
      session.user = {
        // Carried by next-auth's adapter type. Unused: there is no email
        // verification step, because notifications go over WhatsApp, not email.
        emailVerified: null,
        id: token.uid,
        email: session.user?.email ?? '',
        name: session.user?.name ?? '',
        orgId: token.orgId,
        orgSlug: token.orgSlug,
        orgName: token.orgName,
        role: token.role,
        locale: token.locale,
      };
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
