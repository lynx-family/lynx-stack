// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Bench } from 'tinybench';

import { withCodspeed } from '../../src/withCodspeed.js';

runAfterLoadScript(() => {
  if (__MAIN_THREAD__) {
    function fib(n: number): number {
      if (n <= 1) return n;
      return fib(n - 1) + fib(n - 2);
    }

    function fib2(n: number): number {
      const memo: number[] = Array.from({ length: n + 1 });
      const dp = (n: number): number => {
        if (n <= 1) return n;
        if (memo[n]) return memo[n];
        memo[n] = dp(n - 1) + dp(n - 2);
        return memo[n];
      };
      return dp(n);
    }

    function fib3(n: number): number {
      if (n === 0) return 0;
      if (n === 1) return 1;
      let prev = 0, curr = 1;
      for (let i = 2; i <= n; i++) {
        const next = prev + curr;
        prev = curr;
        curr = next;
      }
      return curr;
    }

    const bench = withCodspeed(
      new Bench({
        name: 'simple benchmark',
        time: 5,
        iterations: 20,
      }),
    );

    bench
      .add(`${__REPO_FILEPATH__}::more faster fib(20)`, () => {
        fib3(20);
      })
      .add(`${__REPO_FILEPATH__}::faster fib(20)`, () => {
        fib2(20);
      })
      .add(`${__REPO_FILEPATH__}::slower fib(20)`, () => {
        fib(20);
      });

    bench.runSync();

    console.log(bench.name);
    console.log(JSON.stringify(bench.table(), undefined, 2));
  }
});
