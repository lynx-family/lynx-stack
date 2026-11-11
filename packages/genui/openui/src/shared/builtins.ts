// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { BUILTINS, BUILTIN_NAMES } from '@openuidev/lang-core';

/** Register OpenUI data expressions in the shared parser, evaluator, and prompt registry. */
export function registerOpenUIBuiltins(): void {
  BUILTINS['Append'] ??= {
    name: 'Append',
    signature: 'Append(array, item) → new array',
    description:
      'Returns a new array with one item appended, without modifying the input. An array item stays nested; it is not flattened. Requires an array and exactly one item.',
    fn: (...args) => {
      const [array, item] = args;
      if (args.length !== 2 || !Array.isArray(array)) {
        throw new TypeError('@Append requires an array and exactly one item');
      }
      return [...(array as unknown[]), item];
    },
  };
  BUILTIN_NAMES.add('Append');
}
