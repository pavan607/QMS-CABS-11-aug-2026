import type { NextAuthConfig } from 'next-auth';

/**
 * `npm start` sets NODE_ENV=production, but LAN/intranet is often still HTTP.
 * Secure + __Secure- cookies are ignored on http://, so the session never sticks.
 * Prefer AUTH_URL / NEXTAUTH_URL scheme; override with AUTH_COOKIE_SECURE if needed.
 */
function useSecureAuthCookies(): boolean {
  const override = process.env.AUTH_COOKIE_SECURE;
  if (override === 'false' || override === '0') return false;
  if (override === 'true' || override === '1') return true;
  const url = process.env.AUTH_URL || process.env.NEXTAUTH_URL || '';
  if (url.startsWith('https://')) return true;
  if (url.startsWith('http://')) return false;
  return process.env.NODE_ENV === 'production';
}

const secureCookies = useSecureAuthCookies();

/** Auth.js v5 blocks unknown hosts in production unless trusted (Docker, reverse proxy, LAN). */
function trustHost(): boolean {
  const v = process.env.AUTH_TRUST_HOST;
  if (v === 'false' || v === '0') return false;
  return true;
}

export const authConfig = {
  trustHost: trustHost(),
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt' as const,
    maxAge: 30 * 60,
  },
  cookies: {
    sessionToken: {
      name: secureCookies
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: secureCookies,
      },
    },
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
      const isOnLogin = nextUrl.pathname.startsWith('/login');
      
      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false;
      } else if (isLoggedIn && isOnLogin) {
        return Response.redirect(new URL('/dashboard', nextUrl));
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = (user as any).role;
        token.employee_id = (user as any).employee_id;
        token.designation = (user as any).designation;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        (session.user as any).role = token.role;
        (session.user as any).employee_id = token.employee_id;
        (session.user as any).designation = token.designation;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
