import { __lynx_timing_flag } from '@lynx-js/web-constants';
import type { MainThreadRuntime } from '../../MainThreadRuntime.js';
import type { ElementThreadElement } from '../ElementThreadElement.js';

export function createAttributeAndPropertyFunctionsWithContext(
  runtime: MainThreadRuntime,
) {
  function __SetAttribute(
    element: ElementThreadElement,
    key: string,
    value: string | null | undefined,
  ): void {
    element.setAttribute(key, value ?? null);
    if (key === __lynx_timing_flag && value) {
      runtime._timingFlags.push(value);
    }
  }

  return {
    __SetAttribute,
  };
}
