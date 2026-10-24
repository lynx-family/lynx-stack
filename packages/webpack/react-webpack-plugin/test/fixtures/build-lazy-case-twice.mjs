// Builds the `merge-defines-lazy` case twice with two compilers in one
// process, the way rsbuild builds every environment in one process.
// Runs in plain Node so the plugin and its loaders share one module instance.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { rspack } from '@rspack/core';

const { default: caseConfig } = await import(
  '../cases/main-thread/merge-defines-lazy/rspack.config.js'
);

for (let i = 1; i <= 2; i++) {
  const compiler = rspack({
    ...caseConfig,
    mode: 'none',
    externalsPresets: { node: true },
    output: {
      ...caseConfig.output,
      path: mkdtempSync(path.join(tmpdir(), 'defines-lazy-twice-')),
    },
  });
  await new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      compiler.close(() => {
        if (err) {
          reject(err);
        } else if (stats.hasErrors()) {
          reject(new Error(stats.toString({ all: false, errors: true })));
        } else {
          resolve();
        }
      });
    });
  }).then(
    () => console.info(`build #${i}: ok`),
    (error) => {
      console.info(`build #${i}: ${error.message}`);
      process.exit(1);
    },
  );
}
