// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// This module is pulled into the common chunk, so with sharing enabled every
// page in the group evaluates it once and observes the same state. Without
// sharing each page gets its own copy and the counters move independently.

// Captured at eval time, on purpose. They belong to whichever page evaluated
// this module first, so everything here has to keep working after that page is
// gone — which is what the standalone runtime provides.
const capturedSetTimeout = setTimeout;
const capturedClearTimeout = clearTimeout;
const capturedSetInterval = setInterval;
const capturedClearInterval = clearInterval;
const capturedRequestAnimationFrame = requestAnimationFrame;
const capturedCancelAnimationFrame = cancelAnimationFrame;
const capturedNativeModules = NativeModules;
const CapturedPromise = Promise;

/** Distinguishes module instances: equal across pages only when shared. */
export const instanceId = `${Date.now()}-${
  Math.random().toString(36).slice(2, 7)
}`;

/** Every page that mounted against this module instance, in mount order. */
export const mountedPages: string[] = [];

export function registerPage(name: string): void {
  if (!mountedPages.includes(name)) {
    mountedPages.push(name);
  }
}

let count = 0;
const listeners = new Set<() => void>();

export function getCount(): number {
  return count;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function increment(): void {
  count += 1;
  listeners.forEach((listener) => listener());
}

/**
 * Bumps the counter after a delay, through the captured timer and Promise.
 * Close the page that evaluated this module, then run it from another page:
 * it still resolves when the timers come from the standalone runtime.
 */
export function incrementLater(delayMs = 1500): Promise<void> {
  return new CapturedPromise<void>((resolve) => {
    capturedSetTimeout(() => {
      increment();
      resolve();
    }, delayMs);
  });
}

export interface Check {
  label: string;
  ok: boolean;
}

/** The page's own globals, to compare against the ones this module captured. */
export interface PageGlobals {
  setTimeout: unknown;
  clearTimeout: unknown;
  setInterval: unknown;
  clearInterval: unknown;
  requestAnimationFrame: unknown;
  cancelAnimationFrame: unknown;
  NativeModules: unknown;
}

/**
 * Every page must hold the very objects this module captured. With sharing on
 * the module was evaluated by the standalone runtime, so a match proves the
 * page's globals are the standalone's and outlive any single card. A mismatch
 * is the regression these checks exist to catch: the page took a global off
 * its own LynxView, which dies with it.
 */
export function identityChecks(page: PageGlobals): Check[] {
  return [
    { label: 'setTimeout', ok: page.setTimeout === capturedSetTimeout },
    { label: 'clearTimeout', ok: page.clearTimeout === capturedClearTimeout },
    { label: 'setInterval', ok: page.setInterval === capturedSetInterval },
    {
      label: 'clearInterval',
      ok: page.clearInterval === capturedClearInterval,
    },
    {
      label: 'requestAnimationFrame',
      ok: page.requestAnimationFrame === capturedRequestAnimationFrame,
    },
    {
      label: 'cancelAnimationFrame',
      ok: page.cancelAnimationFrame === capturedCancelAnimationFrame,
    },
    {
      label: 'NativeModules',
      ok: page.NativeModules === capturedNativeModules,
    },
  ];
}

/**
 * Exercises the captured globals rather than just comparing them. Runs from
 * whichever page asks, including one that did not evaluate this module.
 */
export function runtimeChecks(): Promise<Check[]> {
  return new CapturedPromise<Check[]>((resolve) => {
    let timeoutFired = false;
    let cancelledTimeoutFired = false;
    let frameFired = false;
    let cancelledFrameFired = false;
    let intervalTicks = 0;

    capturedSetTimeout(() => {
      timeoutFired = true;
    }, 0);
    capturedClearTimeout(
      capturedSetTimeout(() => {
        cancelledTimeoutFired = true;
      }, 0),
    );

    capturedRequestAnimationFrame(() => {
      frameFired = true;
    });
    capturedCancelAnimationFrame(
      capturedRequestAnimationFrame(() => {
        cancelledFrameFired = true;
      }),
    );

    const intervalId = capturedSetInterval(() => {
      intervalTicks += 1;
    }, 50);

    capturedSetTimeout(() => {
      capturedClearInterval(intervalId);
      const ticksAtStop = intervalTicks;

      capturedSetTimeout(() => {
        resolve([
          { label: 'setTimeout fires', ok: timeoutFired },
          { label: 'clearTimeout cancels', ok: !cancelledTimeoutFired },
          { label: 'setInterval fires', ok: ticksAtStop > 0 },
          { label: 'clearInterval stops', ok: intervalTicks === ticksAtStop },
          { label: 'requestAnimationFrame fires', ok: frameFired },
          { label: 'cancelAnimationFrame cancels', ok: !cancelledFrameFired },
          { label: 'Promise resolves', ok: true },
          {
            label: 'NativeModules reachable',
            ok: typeof capturedNativeModules === 'object'
              && capturedNativeModules !== null,
          },
        ]);
      }, 200);
    }, 500);
  });
}
