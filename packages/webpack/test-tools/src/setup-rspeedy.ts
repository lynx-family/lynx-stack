// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Ported from the former `@lynx-js/vitest-setup` (itself forked from Rsbuild):
// path snapshot serializer + `toHaveLoader` matcher for the rspeedy unit
// tests.

import fs from 'node:fs';
import path from 'node:path';

import type { Configuration, RuleSetRule } from '@rspack/core';
import { expect } from '@rstest/core';
import { createSnapshotSerializer } from 'path-serializer';

declare module '@rstest/core' {
  // `Matchers` is not exported by @rstest/core, so augment `Assertion`.
  // biome-ignore lint/correctness/noUnusedVariables: merging requires the same type parameter
  interface Assertion<T> {
    toHaveLoader: (loader: string | RegExp) => void;
  }
}

declare global {
  // @rstest/core's internal `JestAssertion` extends `jest.Matchers` without
  // declaring the namespace (masked by `skipLibCheck`); declaring it here
  // types the `.not` chain, which resolves through that internal interface.
  // biome-ignore lint/style/noNamespace: must match the `jest.Matchers` reference
  namespace jest {
    // biome-ignore lint/correctness/noUnusedVariables: referenced as `jest.Matchers<void, T>`
    interface Matchers<R, T = unknown> {
      toHaveLoader: (loader: string | RegExp) => R;
    }
  }
}

// Anchor `<ROOT>` to the repository root: vitest always ran from there, but
// rstest runs per-package (cwd = the package), which would break the
// committed snapshots.
function findRepoRoot(from: string): string {
  let dir = from;
  while (!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) {
      return from;
    }
    dir = parent;
  }
  return dir;
}

expect.addSnapshotSerializer(
  createSnapshotSerializer({
    root: findRepoRoot(process.cwd()),
    features: {
      escapeDoubleQuotes: false,
    },
  }),
);

expect.extend({
  toHaveLoader(received: Configuration, expected: string | RegExp) {
    const result = !!received
      .module
      ?.rules
      ?.some(rule => checkRule(rule));

    return {
      pass: result,
      message: () =>
        `Should${this.isNot ? ' not' : ''} have loader ${expected}`,
    };

    function check(target: string) {
      if (typeof expected === 'string') {
        return target === expected;
      }

      return expected.test(target);
    }

    function checkRule(
      rule: RuleSetRule | boolean | null | undefined | 0 | '' | '...',
    ) {
      if (!rule) {
        return false;
      }

      if (typeof rule !== 'object') {
        return false;
      }

      if (rule.oneOf?.some(r => checkRule(r))) {
        return true;
      }

      if (typeof rule.use === 'string') {
        return check(rule.use);
      }

      if (
        rule.use && typeof rule.use === 'object' && !Array.isArray(rule.use)
        && typeof rule.use.loader === 'string'
      ) {
        return check(rule.use.loader);
      }

      if (typeof rule.loader === 'string') {
        return check(rule.loader);
      }

      return Array.isArray(rule.use)
        && rule.use?.some(u => {
          if (typeof u === 'string') {
            return check(u);
          }
          return u && 'loader' in u && check(u.loader);
        });
    }
  },
});
