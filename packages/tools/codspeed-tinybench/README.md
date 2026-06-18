# @lynx-js/codspeed-tinybench

A tiny shared harness to run [tinybench](https://github.com/tinylibs/tinybench)
benchmarks on plain Node while keeping [CodSpeed](https://codspeed.io) reporting.

`rstest` has no `bench()` API, so the repo's benchmarks use `tinybench`
directly. This package wraps a tinybench `Bench` so that:

- under a CodSpeed runner (instrumented), each task is measured with CodSpeed,
  mirroring `@codspeed/vitest-plugin`'s analysis runner;
- otherwise, it falls back to a normal tinybench walltime run and prints a
  table.

## Usage

```js
import { Bench } from 'tinybench';
import { withCodSpeed } from '@lynx-js/codspeed-tinybench';

const bench = new Bench();

bench.add('my benchmark', async () => {
  await doWork();
});

await withCodSpeed(bench, import.meta.url);
```

Run the file directly with `node my.bench.js`. Under CI, CodSpeed instruments
the same `node` invocation (`codspeed run -- … bench`).
