// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useCallback, useEffect, useRef, useState } from 'react';

import { CHANNEL_PREFIX } from './console-wrapper.js';
import type { ConsoleEntry, ConsoleMessage } from './types.js';

export function useConsole(sessionId: string) {
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    // eslint-disable-next-line n/no-unsupported-features/node-builtins -- BroadcastChannel is a browser API, not Node.js
    if (typeof BroadcastChannel === 'undefined') {
      return;
    }
    // eslint-disable-next-line n/no-unsupported-features/node-builtins -- BroadcastChannel is a browser API, not Node.js
    let channel: BroadcastChannel;
    try {
      // eslint-disable-next-line n/no-unsupported-features/node-builtins -- BroadcastChannel is a browser API, not Node.js
      channel = new BroadcastChannel(CHANNEL_PREFIX + sessionId);
    } catch {
      return;
    }
    const buffer: ConsoleEntry[] = [];
    let scheduled = false;
    let rafId: number | undefined;

    channel.onmessage = (event: MessageEvent<ConsoleMessage>) => {
      const msg = event.data;
      buffer.push({
        id: idRef.current++,
        level: msg.level,
        source: msg.source,
        args: msg.args,
        timestamp: msg.timestamp,
      });
      if (!scheduled) {
        scheduled = true;
        rafId = requestAnimationFrame(() => {
          setEntries(prev => [...prev, ...buffer.splice(0)]);
          scheduled = false;
        });
      }
    };

    return () => {
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId);
      }
      channel.close();
    };
  }, [sessionId]);

  const clear = useCallback(() => {
    setEntries([]);
  }, []);

  return { entries, clear };
}
