'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function QualityChecksPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/inspections');
  }, [router]);
  return null;
}
