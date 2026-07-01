'use client';

import { useEffect } from 'react';
import { SessionProvider, useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ThemeProvider } from 'next-themes';

function InactiveUserGuard({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if ((session as any)?.isInactive) {
      signOut({ redirect: false }).then(() => {
        router.push('/login?reason=inactive');
      });
    }
  }, [session, router]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <SessionProvider refetchInterval={60} refetchOnWindowFocus={true}>
        <InactiveUserGuard>
          {children}
        </InactiveUserGuard>
      </SessionProvider>
    </ThemeProvider>
  );
}

