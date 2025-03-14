/**
 * @license
MIT License

Copyright (c) 2023-present Bytedance, Inc. and its affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 */

/**
 * This file is forked from Rsbuild.
 */

// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createSnapshotSerializer } from 'path-serializer';
import { beforeAll, expect } from 'vitest';
import type { Configuration, RuleSetRule } from 'webpack';

declare global {
  var printLogger: boolean;
}

beforeAll((suite) => {
  process.env['REBUILD_TEST_SUITE_CWD'] = suite.file.filepath
    ? path.dirname(suite.file.filepath)
    : '';

  globalThis.printLogger = process.argv.includes('--verbose');
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

expect.addSnapshotSerializer(
  createSnapshotSerializer({
    features: {
      escapeDoubleQuotes: false,
    },
    workspace: path.join(__dirname, '..', '..', '..'),
  }),
);

expect.extend({
  toHaveLoader(received: Configuration, expected: string | RegExp) {
    const result = !!received
      .module
      ?.rules
      ?.some(checkRule);

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

      if (rule.oneOf?.some(checkRule)) {
        return true;
      }

      if (typeof rule.use === 'string') {
        return check(rule.use);
      }

      if (typeof rule.loader === 'string') {
        return check(rule.loader);
      }

      return Array.isArray(rule.use)
        && rule.use?.some(u => {
          if (typeof u === 'string') {
            return check(u);
          }
          if (u === false) {
            return false;
          }
          return u && 'loader' in u && check(u.loader);
        });
    }
  },
});
