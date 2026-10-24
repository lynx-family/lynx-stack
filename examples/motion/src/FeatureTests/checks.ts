// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function near(value: number, expected: number, tolerance = 0.01): void {
  assert(Math.abs(value - expected) <= tolerance, `${value} != ${expected}`);
}

export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function until(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 2500;
  while (!predicate()) {
    assert(Date.now() < deadline, 'Timed out waiting for animation');
    await wait(16);
  }
}

export async function runCases(
  cases: [string, () => void | Promise<void>][],
): Promise<string[]> {
  const results: string[] = [];
  for (const [name, run] of cases) {
    try {
      await run();
      results.push(`PASS ${name}`);
    } catch (error) {
      results.push(`FAIL ${name}: ${String(error)}`);
    }
  }
  return results;
}
