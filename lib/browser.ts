import { useSyncExternalStore } from 'react';

function subscribeNoop() {
  return () => {};
}

function getFirefoxSnapshot(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /firefox/i.test(navigator.userAgent);
}

/** Server and first client paint both false — avoids hydration mismatch from branching UI. */
export function useIsFirefoxBrowser(): boolean {
  return useSyncExternalStore(subscribeNoop, getFirefoxSnapshot, () => false);
}

/** @deprecated Use useIsFirefoxBrowser in components */
export function isFirefoxBrowser(): boolean {
  return getFirefoxSnapshot();
}
