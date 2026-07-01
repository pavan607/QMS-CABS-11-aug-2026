'use client';

import { useState, useEffect, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, Timer, UserX } from 'lucide-react';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isAccountInactive, setIsAccountInactive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [idleMessage, setIdleMessage] = useState(false);
  const [deactivatedMessage, setDeactivatedMessage] = useState(false);

  useEffect(() => {
    const reason = searchParams.get('reason');
    if (reason === 'idle') {
      setIdleMessage(true);
    } else if (reason === 'inactive') {
      setDeactivatedMessage(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        employee_id: employeeId,
        password,
        redirect: false,
      });

      if (result?.error) {
        try {
          const statusRes = await fetch('/api/auth/check-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employee_id: employeeId }),
          });
          const statusData = await statusRes.json();
          if (statusData.inactive) {
            setIsAccountInactive(true);
            setError('Your account has been deactivated. Please contact your administrator.');
          } else {
            setIsAccountInactive(false);
            setError('Invalid Employee ID or password');
          }
        } catch {
          setIsAccountInactive(false);
          setError('Invalid Employee ID or password');
        }
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-200 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-800 px-4 pb-4 pt-2 sm:pt-3">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-4">
          <Image
            src="/logo.png"
            alt="R&QA Inspection Module"
            width={124}
            height={124}
            className="mb-0 h-32 w-32 object-contain"
            priority
          />
          <h1 className="-mt-2 text-3xl font-bold leading-tight tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
            R&amp;QA Inspection Module
          </h1>
          {/* <p className="text-muted-foreground mt-1 text-base leading-tight">Enterprise Quality Control &amp; Compliance</p> */}
        </div>

        <Card className="border-neutral-200 dark:border-neutral-800 shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Sign In</CardTitle>
            <CardDescription>Enter your credentials to access the QMS platform</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {idleMessage && (
                <Alert className="bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-950/50 dark:border-orange-800 dark:text-orange-200">
                  <Timer className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <AlertDescription>
                    Your session expired due to inactivity. Please sign in again.
                  </AlertDescription>
                </Alert>
              )}
              {deactivatedMessage && (
                <Alert className="bg-red-50 border-red-200 text-red-900 dark:bg-red-950/50 dark:border-red-800 dark:text-red-200">
                  <UserX className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <AlertDescription>
                    Your account has been deactivated. You have been signed out.
                  </AlertDescription>
                </Alert>
              )}
              {error && (
                <Alert variant={isAccountInactive ? undefined : "destructive"} className={isAccountInactive ? "bg-red-50 border-red-300 text-red-900 dark:bg-red-950/50 dark:border-red-800 dark:text-red-200" : undefined}>
                  {isAccountInactive ? <UserX className="h-4 w-4 text-red-600 dark:text-red-400" /> : <AlertCircle className="h-4 w-4" />}
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="employee_id">Employee ID</Label>
                <Input
                  id="employee_id"
                  type="text"
                  placeholder="Enter your employee ID"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                  required
                  disabled={loading}
                  className="h-11"
                  autoComplete="username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11"
                  autoComplete="current-password"
                />
              </div>

              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-1 border-t pt-4 text-center text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} R&amp;QA Inspection Module. All rights reserved.</p>
            <p>Jointly designed and developed by CABS and Techfluent Solutions Pvt Ltd</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
