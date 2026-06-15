// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from 'vitest';

import { runSubset } from '../../../wpt/run.ts';
import type { TestModule } from '../../../wpt/run.ts';

describe('US-462 WPT runner harness', () => {
  it('synthetic 2-test file: 1 passes, 1 fails', async () => {
    const result = await runSubset({
      subset: {
        schemaVersion: '1',
        gateThreshold: 0.7,
        directories: [
          { path: 'synthetic', tests: ['passing', 'failing'] },
        ],
      },
      resolveTest(_dir, name): TestModule | undefined {
        if (name === 'passing') {
          return {
            name: 'passing',
            fn(ctx) {
              ctx.assert_equals(1 + 1, 2);
            },
          };
        }
        if (name === 'failing') {
          return {
            name: 'failing',
            fn(ctx) {
              ctx.assert_equals(1 + 1, 3, 'arithmetic is broken');
            },
          };
        }
        return undefined;
      },
    });

    expect(result.schemaVersion).toBe('1');
    expect(result.totalTests).toBe(2);
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.overallPassRate).toBe(0.5);
    expect(result.gateThreshold).toBe(0.7);
    expect(result.directories).toHaveLength(1);
    const dir = result.directories[0]!;
    expect(dir.tests).toHaveLength(2);
    expect(dir.tests[0]?.status).toBe('pass');
    expect(dir.tests[1]?.status).toBe('fail');
    expect(dir.tests[1]?.message).toBe('arithmetic is broken');
  });

  it('skip is honored', async () => {
    const result = await runSubset({
      subset: {
        schemaVersion: '1',
        gateThreshold: 0.7,
        directories: [
          { path: 'x', tests: ['only-test'] },
        ],
      },
      resolveTest: () => ({
        name: 'only-test',
        fn(ctx) {
          ctx.skip('not implementable without engine support');
        },
      }),
    });
    expect(result.skipped).toBe(1);
    expect(result.directories[0]?.tests[0]?.status).toBe('skip');
    expect(result.directories[0]?.tests[0]?.message).toBe(
      'not implementable without engine support',
    );
  });

  it('unresolved test name is counted as skip with "no implementation"', async () => {
    const result = await runSubset({
      subset: {
        schemaVersion: '1',
        gateThreshold: 0.7,
        directories: [
          { path: 'x', tests: ['missing'] },
        ],
      },
      resolveTest: () => undefined,
    });
    expect(result.skipped).toBe(1);
    expect(result.directories[0]?.tests[0]?.message).toBe('no implementation');
  });

  it('unexpected errors are categorized as "error" (not "fail")', async () => {
    const result = await runSubset({
      subset: {
        schemaVersion: '1',
        gateThreshold: 0.7,
        directories: [
          { path: 'x', tests: ['boom'] },
        ],
      },
      resolveTest: () => ({
        name: 'boom',
        fn() {
          throw new Error('uncaught');
        },
      }),
    });
    expect(result.errored).toBe(1);
    expect(result.directories[0]?.tests[0]?.status).toBe('error');
  });

  it('beforeEachTest runs before every test', async () => {
    let calls = 0;
    await runSubset({
      subset: {
        schemaVersion: '1',
        gateThreshold: 0.7,
        directories: [
          { path: 'x', tests: ['a', 'b', 'c'] },
        ],
      },
      beforeEachTest() {
        calls++;
      },
      resolveTest: () => ({
        name: 'noop',
        fn() {
          // noop
        },
      }),
    });
    expect(calls).toBe(3);
  });

  it('directory passRate computed correctly', async () => {
    const result = await runSubset({
      subset: {
        schemaVersion: '1',
        gateThreshold: 0.7,
        directories: [
          { path: 'x', tests: ['a', 'b', 'c', 'd'] },
        ],
      },
      resolveTest(_dir, name): TestModule | undefined {
        return {
          name,
          fn(ctx) {
            if (name === 'd') ctx.assert_equals(1, 2);
          },
        };
      },
    });
    const dir = result.directories[0]!;
    expect(dir.passed).toBe(3);
    expect(dir.failed).toBe(1);
    expect(dir.passRate).toBe(0.75);
  });
});
