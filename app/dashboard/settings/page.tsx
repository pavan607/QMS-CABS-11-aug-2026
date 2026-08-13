import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { SettingsPageClient } from '@/components/settings-page-client';

export default async function SettingsPage() {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== 'administrator') {
    redirect('/dashboard');
  }
  return <SettingsPageClient />;
}
