import { useState, useEffect, useRef, useCallback } from 'react';
import type { ConsoleEntry, ConsoleMessage } from './types.js';
import { CHANNEL_PREFIX } from './console-wrapper.js';

export function useConsole(sessionId: string) {
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      return;
    }
    let channel: BroadcastChannel;
    try {
      channel = new BroadcastChannel(CHANNEL_PREFIX + sessionId);
    } catch {
      return;
    }
    const buffer: ConsoleEntry[] = [];
    let scheduled = false;

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
        requestAnimationFrame(() => {
          setEntries(prev => [...prev, ...buffer.splice(0)]);
          scheduled = false;
        });
      }
    };

    return () => channel.close();
  }, [sessionId]);

  const clear = useCallback(() => {
    setEntries([]);
  }, []);

  return { entries, clear };
}
