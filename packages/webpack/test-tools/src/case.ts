// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';

import {
  ECompilerType,
  NormalProcessor,
  describeByWalk,
} from '@rspack/test-tools';
import type { TCompilerOptions } from '@rspack/test-tools';
import fs from 'fs-extra';
import { rimrafSync } from 'rimraf';
import { describe } from 'vitest';

import {
  RspeedyNormalRunnerFactory,
  createRunner,
  getOptions,
} from './suite.js';
import type { ITestSuite, TAfterExecuteFn, TBeforeExecuteFn } from './suite.js';

function createCase(
  name: string,
  src: string,
  dist: string,
  cwd: string,
  options: {
    afterExecute?: TAfterExecuteFn | undefined;
    beforeExecute?: TBeforeExecuteFn | undefined;
  },
) {
  async function createOptions<T extends ECompilerType>(
    configFile: string,
  ): Promise<TCompilerOptions<T>> {
    const defaultOptions: TCompilerOptions<T> = {
      context: cwd,
      entry: src,
      mode: 'none',
      output: {
        publicPath: '/',
        path: dist,
      },
      resolve: {
        extensions: ['.jsx', '.tsx', '.js', '.ts', '.json'],
        extensionAlias: {
          '.js': ['.ts', '.js'],
          '.jsx': ['.tsx', '.jsx'],
          '.mjs': ['.mts', '.mjs'],
        },
      },
    };
    const caseOptions = await getOptions<TCompilerOptions<T>>(configFile);
    const { merge } = await import('webpack-merge');
    return merge(defaultOptions, caseOptions);
  }

  describe(name, () => {
    for (const compilerType of [ECompilerType.Rspack, ECompilerType.Webpack]) {
      const caseName = `${name} - ${compilerType}`;
      const caseConfigFile = path.join(src, `${compilerType}.config.js`);

      const runner = createRunner(
        src,
        dist,
        RspeedyNormalRunnerFactory,
        options,
      );

      if (!fs.existsSync(caseConfigFile)) {
        describe.skip(caseName);
        return;
      }

      describe(caseName, async () => {
        const caseOptions = await createOptions<ECompilerType>(caseConfigFile);
        runner(
          caseName,
          new NormalProcessor<ECompilerType>({
            defaultOptions: () => caseOptions,
            overrideOptions: (_, options) => {
              options.output ??= {};
              options.output.filename ??= `${compilerType}.bundle.js`;
              options.output.pathinfo = 'verbose';
              options.target = 'node';
            },
            name: caseName,
            compilerType,
            root: cwd,
            runable: true,
          }),
        );
      });
    }
  });
}

export function describeCases(suite: ITestSuite): void {
  const distPath = path.resolve(suite.casePath, '../dist/config');
  rimrafSync(distPath);
  describeByWalk(suite.name, (name, src, dist) => {
    createCase(name, src, dist, suite.casePath, {
      afterExecute: suite.afterExecute,
      beforeExecute: suite.beforeExecute,
    });
  }, {
    source: suite.casePath,
    dist: distPath,
    describe,
  });
}
