// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useEffect, useMemo, useRef } from 'preact/hooks';

/**
 * `useLynxGlobalEventListener` help you `addListener` as early as possible.
 *
 * @example
 *
 * Use this hooks to listen to event 'exposure' and event 'disexposure'
 *
 * ```jsx
 * function App() {
 *   useLynxGlobalEventListener('exposure', (e) => {
 *     console.log("exposure", e)
 *   })
 *   useLynxGlobalEventListener('disexposure', (e) => {
 *     console.log("disexposure", e)
 *   })
 *   return (
 *     <view
 *       style='width: 100px; height: 100px; background-color: red;'
 *       exposure-id='a'
 *     />
 *   )
 * }
 * ```
 *
 * @param eventName - Event name to listen
 * @param listener - Event handler
 * @public
 */
export function useLynxGlobalEventListener<T extends (...args: any[]) => void>(
  eventName: string,
  listener: T,
): void {
  'background only';

  const previousArgsRef = useRef<[string, T]>();

  useMemo(() => {
    if (previousArgsRef.current) {
      const [eventName, listener] = previousArgsRef.current;
      lynx.getJSModule('GlobalEventEmitter').removeListener(eventName, listener);
    }
    lynx.getJSModule('GlobalEventEmitter').addListener(eventName, listener);
    previousArgsRef.current = [eventName, listener];
  }, [eventName, listener]);

  useEffect(() => {
    return () => {
      if (previousArgsRef.current) {
        const [eventName, listener] = previousArgsRef.current;
        lynx.getJSModule('GlobalEventEmitter').removeListener(eventName, listener);
      }
    };
  }, []);
}
