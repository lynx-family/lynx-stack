// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Concurrency-capped, priority-aware mount queue.
 *
 * Used by the A2UI playground Showcase to keep the number of simultaneous
 * `<lynx-view>`-bearing iframes bounded. Without it, mounting all ~43 cards
 * at once spawns ~43 Web Workers and saturates the main thread.
 *
 * Selection rule: among registered cards that aren't yet armed and have
 * priority >= NEAR, pick the highest-priority cards (ties broken by
 * registration order) until `maxConcurrent` slots are full. A slot is
 * occupied by an armed card that has not yet called `markReady`.
 *
 * Armed is sticky: once a card is armed, it stays armed until unregistered.
 * `markReady` only frees the slot — it does not un-arm the card.
 */

export const PRIORITY = {
  OFFSCREEN: 0,
  NEAR: 1,
  IN_VIEW: 2,
} as const;

export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY];

interface Entry {
  id: string;
  priority: Priority;
  armed: boolean;
  ready: boolean;
  order: number;
}

export type Listener = (armed: ReadonlySet<string>) => void;

export class MountQueue {
  private readonly maxConcurrent: number;
  private readonly entries = new Map<string, Entry>();
  private readonly listeners = new Set<Listener>();
  private nextOrder = 0;
  private lastArmedSnapshot = new Set<string>();

  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent;
  }

  register(id: string): void {
    if (this.entries.has(id)) return;
    this.entries.set(id, {
      id,
      priority: PRIORITY.OFFSCREEN,
      armed: false,
      ready: false,
      order: this.nextOrder++,
    });
    this.reschedule();
  }

  unregister(id: string): void {
    if (!this.entries.delete(id)) return;
    this.reschedule();
  }

  setPriority(id: string, priority: Priority): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    if (entry.priority === priority) return;
    entry.priority = priority;
    this.reschedule();
  }

  markReady(id: string): void {
    const entry = this.entries.get(id);
    if (!entry || entry.ready) return;
    entry.ready = true;
    this.reschedule();
  }

  isArmed(id: string): boolean {
    return this.entries.get(id)?.armed ?? false;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private occupiedSlots(): number {
    let n = 0;
    for (const entry of this.entries.values()) {
      if (entry.armed && !entry.ready) n++;
    }
    return n;
  }

  private reschedule(): void {
    let free = this.maxConcurrent - this.occupiedSlots();
    if (free > 0) {
      const pending = [...this.entries.values()].filter(
        (e) => !e.armed && e.priority >= PRIORITY.NEAR,
      );
      pending.sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return a.order - b.order;
      });
      for (const entry of pending) {
        if (free <= 0) break;
        entry.armed = true;
        free--;
      }
    }

    const next = new Set<string>();
    for (const entry of this.entries.values()) {
      if (entry.armed) next.add(entry.id);
    }
    if (!setsEqual(next, this.lastArmedSnapshot)) {
      this.lastArmedSnapshot = next;
      for (const listener of this.listeners) listener(next);
    }
  }
}

function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}
