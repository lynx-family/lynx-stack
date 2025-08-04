// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { CSSRuleObject } from '../types/tailwind-types.js';

export function createFunctionCallUtility(
  property: string,
  fn: string,
  options?: { emptyFallback?: string },
): (value: unknown) => CSSRuleObject | null {
  return (value: unknown) => {
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();

    if (trimmed === '') {
      return options?.emptyFallback == null
        ? null
        : { [property]: options.emptyFallback };
    }
    return {
      [property]: `${fn}(${trimmed})`,
    };
  };
}
