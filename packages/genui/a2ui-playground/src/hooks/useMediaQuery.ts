// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useEffect, useState } from 'react';

// Reactive `window.matchMedia(query)` boolean. Subscribes to viewport changes
// so React stays in sync without ad-hoc resize listeners. Client-only — the
// playground is a CSR Vite app, so a sync read of matchMedia on mount is fine.
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const mql = window.matchMedia(query);
    const handle = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', handle);
    return () => mql.removeEventListener('change', handle);
  }, [query]);

  return matches;
}
