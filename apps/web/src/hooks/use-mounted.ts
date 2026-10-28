'use client';

import * as React from 'react';

const emptySubscribe = () => () => {};

/**
 * Hook to determine if the component has mounted on the client.
 * Uses `useSyncExternalStore` to guarantee that the server-rendered HTML
 * and client-hydrated DOM align perfectly without hydration mismatches.
 */
export function useMounted(): boolean {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
