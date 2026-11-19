// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Captured at eval time on purpose: they must outlive the page that evaluated this module.
const capturedSetTimeout = setTimeout;
const capturedClearTimeout = clearTimeout;
const capturedSetInterval = setInterval;
const capturedClearInterval = clearInterval;
const capturedRequestAnimationFrame = requestAnimationFrame;
const capturedCancelAnimationFrame = cancelAnimationFrame;
const capturedNativeModules = NativeModules;
const CapturedPromise = Promise;

export const instanceId = `${Date.now()}-${
  Math.random().toString(36).slice(2, 7)
}`;

let count = 0;
const livePages: string[] = [];
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function getCount(): number {
  return count;
}

export function getLivePages(): string {
  const names = [...new Set(livePages)];
  return names
    .map((name) => {
      const instances = livePages.filter((page) => page === name).length;
      return instances > 1 ? `${name} ×${instances}` : name;
    })
    .join(', ');
}

export function registerPage(name: string): () => void {
  livePages.push(name);
  notify();
  return () => {
    livePages.splice(livePages.indexOf(name), 1);
    notify();
  };
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function increment(): void {
  count += 1;
  notify();
}

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

export interface PageGlobals {
  setTimeout: unknown;
  clearTimeout: unknown;
  setInterval: unknown;
  clearInterval: unknown;
  requestAnimationFrame: unknown;
  cancelAnimationFrame: unknown;
  NativeModules: unknown;
}

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
