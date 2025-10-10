// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';
import path from 'node:path';

import {
  ECompilerType,
  HotRunnerFactory,
  HotSnapshotProcessor,
  describeByWalk,
} from '@rspack/test-tools';
import type { TCompilerOptions } from '@rspack/test-tools';
import fs from 'fs-extra';
import { rimrafSync } from 'rimraf';
import { describe, test } from 'vitest';

import { createHotOptions } from './hot.js';
import type { IRspeedyHotProcessorOptions } from './hot.js';
import { createRunner, getOptions } from './suite.js';
import type { ITestSuite, TImportedBundler } from './suite.js';

export interface IRspeedyHotSnapshotProcessorOptions<T extends ECompilerType>
  extends IRspeedyHotProcessorOptions<T>
{
  snapshot: string;
}

class RspeedyHotSnapshotProcessor<T extends ECompilerType>
  extends HotSnapshotProcessor<T>
{
  constructor(options: IRspeedyHotSnapshotProcessorOptions<T>) {
    super({
      ...createHotOptions(options),
      name: options.name,
      compilerType: options.compilerType,
      target: 'node',
      snapshot: options.snapshot,
      getModuleHandler: (file) => {
        const require = createRequire(import.meta.url);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
        return Object.keys(require(file).modules) || [];
      },
    });
  }
}

function createCase(name: string, src: string, dist: string, cwd: string) {
  describe(name, () => {
    for (const compilerType of [ECompilerType.Rspack]) {
      const caseName = `${name} - ${compilerType}`;
      const caseConfigFile = path.join(src, `${compilerType}.config.js`);
      const compilerDist = path.join(dist, compilerType);
      const runner = createRunner(src, compilerDist, HotRunnerFactory);

      describe(caseName, async () => {
        if (!fs.existsSync(caseConfigFile)) {
          test.skip(caseName);
          return;
        }
        const bundler = await import(
          compilerType === ECompilerType.Rspack ? '@rspack/core' : 'webpack'
        ) as TImportedBundler;
        const caseOptions = await getOptions<TCompilerOptions<ECompilerType>>(
          caseConfigFile,
        );
        runner(
          caseName,
          new RspeedyHotSnapshotProcessor<ECompilerType>({
            bundler,
            caseOptions,
            src,
            dist: compilerDist,
            cwd,
            name: caseName,
            compilerType,
            snapshot: `__snapshot__/${compilerType}`,
          }),
        );
      });
    }
  });
}

export function hotSnapshotCases(suite: ITestSuite): void {
  const distPath = path.resolve(suite.casePath, '../js/hot-snapshot');
  rimrafSync(distPath);
  describeByWalk(suite.name, (name, src, dist) => {
    createCase(name, src, dist, suite.casePath);
  }, {
    source: suite.casePath,
    dist: distPath,
    describe,
  });
}
