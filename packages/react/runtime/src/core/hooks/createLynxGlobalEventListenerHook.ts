// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { useEffect, useMemo, useRef } from './react.js';
import { addLynxGlobalEventListener, removeLynxGlobalEventListener } from '../lynx-global-event-emitter.js';

interface LynxGlobalEventListenerHookDeps {
  useEffect: typeof useEffect;
  useMemo: typeof useMemo;
  useRef: typeof useRef;
}

export type LynxGlobalEventListenerHook = <T extends (...args: any[]) => void>(
  eventName: string,
  listener: T,
) => void;

export function createLynxGlobalEventListenerHook(
  { useEffect, useMemo, useRef }: LynxGlobalEventListenerHookDeps,
): LynxGlobalEventListenerHook {
  return function useLynxGlobalEventListener<T extends (...args: any[]) => void>(
    eventName: string,
    listener: T,
  ): void {
    'background only';

    const previousArgsRef = useRef<[string, T]>();

    useMemo(() => {
      if (previousArgsRef.current) {
        const [eventName, listener] = previousArgsRef.current;
        removeLynxGlobalEventListener(eventName, listener);
      }
      addLynxGlobalEventListener(eventName, listener);
      previousArgsRef.current = [eventName, listener];
    }, [eventName, listener]);

    useEffect(() => {
      return () => {
        if (previousArgsRef.current) {
          const [eventName, listener] = previousArgsRef.current;
          removeLynxGlobalEventListener(eventName, listener);
        }
      };
    }, []);
  };
}
