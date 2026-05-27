// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import type { Priority } from '../utils/mountQueue.js';
import { MountQueue, PRIORITY } from '../utils/mountQueue.js';

const MountQueueContext = createContext<MountQueue | null>(null);

interface MountQueueProviderProps {
  maxConcurrent: number;
  /**
   * Change to force a full queue reset (e.g. when the theme or protocol
   * flips, which invalidates all rendered previews). Cards re-register
   * with a fresh queue and the top-K visible ones get armed again, so
   * the user still sees a staggered re-load instead of 43 simultaneous
   * iframe reloads.
   */
  resetKey?: string | number;
  children: ReactNode;
}

export function MountQueueProvider(props: MountQueueProviderProps) {
  const { children, maxConcurrent, resetKey } = props;
  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey is intentionally a reset trigger; we want a fresh queue when it changes.
  const queue = useMemo(
    () => new MountQueue(maxConcurrent),
    [maxConcurrent, resetKey],
  );
  return (
    <MountQueueContext.Provider value={queue}>
      {children}
    </MountQueueContext.Provider>
  );
}

/**
 * Register a card with the page's MountQueue. Returns whether this card has
 * been "armed" (slot granted) and a `markReady` callback to free the slot
 * after the card's iframe has finished its first boot.
 *
 * `priority` should reflect the card's current viewport relationship.
 * Callers typically set it from an IntersectionObserver.
 *
 * If no provider is mounted (e.g. card used outside a queue), the card is
 * eagerly armed — same as if the queue had unlimited slots. This keeps
 * `useQueuedMount` safe to call from components used in multiple contexts.
 */
export function useQueuedMount(
  id: string,
  priority: Priority,
): { armed: boolean; markReady: () => void } {
  const queue = useContext(MountQueueContext);
  const [armed, setArmed] = useState<boolean>(() => queue === null);

  useEffect(() => {
    if (!queue) return;
    queue.register(id);
    setArmed(queue.isArmed(id));
    const unsubscribe = queue.subscribe((armedSet) => {
      setArmed(armedSet.has(id));
    });
    return () => {
      unsubscribe();
      queue.unregister(id);
    };
  }, [id, queue]);

  useEffect(() => {
    if (!queue) return;
    queue.setPriority(id, priority);
  }, [id, priority, queue]);

  const markReady = useCallback(() => {
    queue?.markReady(id);
  }, [id, queue]);

  return { armed, markReady };
}

export { PRIORITY };
export type { Priority };
