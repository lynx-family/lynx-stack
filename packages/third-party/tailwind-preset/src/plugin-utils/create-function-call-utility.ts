// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { CSSRuleObject } from 'tailwindcss/types/config.js';

export function createFunctionCallUtility(
  property: string,
  fn: string,
): (value: string) => CSSRuleObject | null {
  return (value: string) => {
    if (typeof value !== 'string') return null;
    return {
      [property]: `${fn}(${value})`,
    };
  };
}
