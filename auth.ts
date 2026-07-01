import 'dotenv/config';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { normalizeEmployeeId } from '@/lib/employee-id';

const STATUS_RECHECK_INTERVAL_MS = 60_000;

async function getUserByEmployeeId(employeeId: string) {
  const id = normalizeEmployeeId(employeeId);
  if (!id) return undefined;
  try {
    const result = await pool.query(
      `SELECT * FROM users WHERE UPPER(TRIM(COALESCE(employee_id, ''))) = $1`,
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}

export const { auth, signIn, signOut, handlers } = NextAuth({
  ...authConfig,
  callbacks: {
    authorized: authConfig.callbacks?.authorized,
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = (user as any).role;
        token.employee_id = (user as any).employee_id;
        token.designation = (user as any).designation;
        token.statusCheckedAt = Date.now();
        token.isInactive = false;
      }

      if (trigger === 'update' && session && typeof session === 'object') {
        const s = session as Record<string, unknown>;
        if (typeof s.name === 'string' && s.name.trim()) token.name = s.name.trim();
        if (typeof s.email === 'string' && s.email.trim()) token.email = s.email.trim();
        if (typeof s.designation === 'string') token.designation = s.designation;
      }

      const now = Date.now();
      const lastChecked = token.statusCheckedAt as number | undefined;
      if (token.id && (!lastChecked || now - lastChecked > STATUS_RECHECK_INTERVAL_MS)) {
        try {
          const result = await pool.query('SELECT status FROM users WHERE id = $1', [token.id]);
          token.isInactive = !result.rows[0] || result.rows[0].status !== 'active';
          token.statusCheckedAt = now;
        } catch (error) {
          console.error('Failed to re-check user status:', error);
        }
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
      if (token.isInactive) {
        (session as any).isInactive = true;
      }
      return session;
    },
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const rawId = typeof credentials?.employee_id === 'string' ? credentials.employee_id : '';
        const rawPw = typeof credentials?.password === 'string' ? credentials.password : '';
        const employee_id = normalizeEmployeeId(rawId);
        const password = rawPw.trim();

        const parsedCredentials = z
          .object({ employee_id: z.string().min(1), password: z.string().min(6) })
          .safeParse({ employee_id, password });

        if (parsedCredentials.success) {
          const user = await getUserByEmployeeId(parsedCredentials.data.employee_id);
          if (!user) return null;

          if (user.status !== 'active') return null;

          const passwordsMatch = await bcrypt.compare(password, user.password);

          if (passwordsMatch) {
            return {
              id: user.id.toString(),
              email: user.email || '',
              name: user.name,
              role: user.role,
              employee_id: user.employee_id,
              designation: user.designation,
            };
          }
        }

        console.log('Invalid credentials');
        return null;
      },
    }),
  ],
});
