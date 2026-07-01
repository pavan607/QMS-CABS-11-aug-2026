'use client';

import { useEffect, useRef, useState } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LogOut, Timer } from 'lucide-react';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const WARNING_BEFORE_MS = 60 * 1000;
const WARNING_AT_MS = IDLE_TIMEOUT_MS - WARNING_BEFORE_MS;

export function IdleTimeoutHandler() {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const lastActivityRef = useRef(Date.now());
  const loggingOutRef = useRef(false);
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    let tickInterval: ReturnType<typeof setInterval> | null = null;

    function resetActivity() {
      lastActivityRef.current = Date.now();
    }

    function tick() {
      if (loggingOutRef.current) return;

      const idle = Date.now() - lastActivityRef.current;

      if (idle >= IDLE_TIMEOUT_MS) {
        doLogout();
      } else if (idle >= WARNING_AT_MS) {
        const remaining = Math.ceil((IDLE_TIMEOUT_MS - idle) / 1000);
        setShowWarning(true);
        setCountdown(Math.max(0, remaining));
      } else {
        setShowWarning(false);
        setCountdown(60);
      }
    }

    async function doLogout() {
      if (loggingOutRef.current) return;
      loggingOutRef.current = true;
      if (tickInterval) clearInterval(tickInterval);
      setShowWarning(false);
      await signOut({ redirect: false });
      routerRef.current.push('/login?reason=idle');
    }

    let lastThrottle = 0;
    function onActivity() {
      const now = Date.now();
      if (now - lastThrottle < 1000) return;
      lastThrottle = now;

      const idle = now - lastActivityRef.current;
      if (idle < WARNING_AT_MS) {
        resetActivity();
      }
    }

    const events: (keyof DocumentEventMap)[] = [
      'mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click',
    ];
    events.forEach(e => document.addEventListener(e, onActivity, { passive: true }));

    resetActivity();
    tickInterval = setInterval(tick, 1000);

    return () => {
      events.forEach(e => document.removeEventListener(e, onActivity));
      if (tickInterval) clearInterval(tickInterval);
    };
  }, []);

  function handleStayLoggedIn() {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setCountdown(60);
  }

  async function handleLogoutNow() {
    loggingOutRef.current = true;
    setShowWarning(false);
    await signOut({ redirect: false });
    router.push('/login?reason=idle');
  }

  return (
    <Dialog open={showWarning} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950/50">
              <Timer className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <DialogTitle className="text-lg">Session Timeout Warning</DialogTitle>
          </div>
          <DialogDescription className="text-sm leading-relaxed">
            You have been inactive for a while. For security purposes, your session will
            expire automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center py-4">
          <div className="flex flex-col items-center gap-2">
            <div className="text-4xl font-bold tabular-nums text-orange-600 dark:text-orange-400">
              {countdown}s
            </div>
            <p className="text-sm text-muted-foreground">until automatic logout</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleLogoutNow} className="gap-2">
            <LogOut className="h-4 w-4" />
            Logout Now
          </Button>
          <Button onClick={handleStayLoggedIn} className="gap-2">
            Stay Logged In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
