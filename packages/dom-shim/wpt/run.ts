// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * WPT runner harness. See Shim_Implementation_PRD.md US-462.
 *
 * Loads the per-test modules referenced by subset.json, runs each
 * against a freshly initialized Shim (the consuming caller seeds the
 * PAPI globals), and produces a result record. The CLI (entry below)
 * writes results to `baseline.json` per US-463.
 */

import { AssertionError, SkipError, createContext } from './testharness.ts';

export interface TestModule {
  name: string;
  fn(ctx: ReturnType<typeof createContext>['ctx']): void | Promise<void>;
}

export type TestStatus = 'pass' | 'fail' | 'error' | 'skip';

export interface TestResult {
  directory: string;
  name: string;
  status: TestStatus;
  message?: string;
  diagnostics: string[];
}

export interface DirectoryResult {
  path: string;
  passed: number;
  failed: number;
  errored: number;
  skipped: number;
  passRate: number;
  tests: TestResult[];
}

export interface RunResult {
  schemaVersion: string;
  startedAt: string;
  finishedAt: string;
  totalTests: number;
  passed: number;
  failed: number;
  errored: number;
  skipped: number;
  overallPassRate: number;
  gateThreshold: number;
  directories: DirectoryResult[];
}

export interface RunOptions {
  /** subset.json content. */
  subset: {
    schemaVersion: string;
    gateThreshold: number;
    directories: Array<{ path: string; tests: string[] }>;
  };
  /**
   * Resolve a test entry to a runnable module. Returning `undefined`
   * skips the test (counted as skip with message 'no implementation').
   */
  resolveTest(directory: string, name: string): TestModule | undefined;
  /**
   * Optional: setup function called before EACH test. Use to reset Shim
   * state (caches, scheduler, document, PAPI mocks) per test.
   */
  beforeEachTest?: () => void;
  now?: () => Date;
}

async function runOne(
  module: TestModule,
): Promise<{ status: TestStatus; message?: string; diagnostics: string[] }> {
  const { ctx, diagnostics } = createContext();
  try {
    await module.fn(ctx);
    return { status: 'pass', diagnostics };
  } catch (e) {
    if (e instanceof SkipError) {
      return { status: 'skip', message: e.reason, diagnostics };
    }
    if (e instanceof AssertionError) {
      return { status: 'fail', message: e.msg, diagnostics };
    }
    return { status: 'error', message: String(e), diagnostics };
  }
}

export async function runSubset(options: RunOptions): Promise<RunResult> {
  const now = options.now ?? (() => new Date());
  const startedAt = now().toISOString();

  let totalTests = 0;
  let passed = 0;
  let failed = 0;
  let errored = 0;
  let skipped = 0;
  const directories: DirectoryResult[] = [];

  for (const dir of options.subset.directories) {
    const tests: TestResult[] = [];
    let dPassed = 0;
    let dFailed = 0;
    let dErrored = 0;
    let dSkipped = 0;
    for (const name of dir.tests) {
      totalTests++;
      options.beforeEachTest?.();
      const module = options.resolveTest(dir.path, name);
      if (module === undefined) {
        const result: TestResult = {
          directory: dir.path,
          name,
          status: 'skip',
          message: 'no implementation',
          diagnostics: [],
        };
        tests.push(result);
        dSkipped++;
        skipped++;
        continue;
      }
      const r = await runOne(module);
      const result: TestResult = {
        directory: dir.path,
        name,
        status: r.status,
        message: r.message,
        diagnostics: r.diagnostics,
      };
      tests.push(result);
      switch (r.status) {
        case 'pass':
          dPassed++;
          passed++;
          break;
        case 'fail':
          dFailed++;
          failed++;
          break;
        case 'error':
          dErrored++;
          errored++;
          break;
        case 'skip':
          dSkipped++;
          skipped++;
          break;
        default:
          break;
      }
    }
    const directoryPassRate = dir.tests.length === 0
      ? 0
      : dPassed / dir.tests.length;
    directories.push({
      path: dir.path,
      passed: dPassed,
      failed: dFailed,
      errored: dErrored,
      skipped: dSkipped,
      passRate: directoryPassRate,
      tests,
    });
  }

  const overallPassRate = totalTests === 0 ? 0 : passed / totalTests;
  const finishedAt = now().toISOString();

  return {
    schemaVersion: '1',
    startedAt,
    finishedAt,
    totalTests,
    passed,
    failed,
    errored,
    skipped,
    overallPassRate,
    gateThreshold: options.subset.gateThreshold,
    directories,
  };
}
