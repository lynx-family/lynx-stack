// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';

import {
  ECompilerType,
  HotProcessor,
  HotRunnerFactory,
  describeByWalk,
} from '@rspack/test-tools';
import type {
  IHotProcessorOptions,
  ITestContext,
  TCompilerOptions,
} from '@rspack/test-tools';
import fs from 'fs-extra';
import { rimrafSync } from 'rimraf';
import { describe, test } from 'vitest';

import { TestHotUpdatePlugin } from './plugins/hot-update.js';
import { createRunner, getOptions } from './suite.js';
import type { ITestSuite, TImportedBundler } from './suite.js';

export function createHotOptions<T extends ECompilerType>({
  compilerType,
  bundler,
  caseOptions,
  src,
  dist,
  cwd,
}: IRspeedyHotProcessorOptions<T>): Pick<
  IHotProcessorOptions<T>,
  'defaultOptions' | 'overrideOptions'
> {
  return {
    defaultOptions: function() {
      return { ...caseOptions };
    },
    overrideOptions: function(
      this: RspeedyHotProcessor<T>,
      _: ITestContext,
      options: TCompilerOptions<T>,
    ) {
      options.mode ??= 'development';
      options.devtool ??= false;
      options.context ??= cwd;
      options.entry ??= src;
      options.output ??= {};
      options.output.path ??= dist;
      options.output.filename ??= `${compilerType}-bundle.js`;
      options.output.chunkFilename ??= '[name].chunk.[fullhash].js';
      options.output.pathinfo ??= true;
      options.output.publicPath ??= 'https://test.cases/path/';
      options.output.chunkFormat ??= 'commonjs';
      options.optimization ??= {};
      options.optimization.moduleIds ??= 'named';
      options.module ??= {};
      options.module.rules ??= [];
      options.module.rules.push({
        loader: path.resolve(
          require.resolve('@rspack/test-tools'),
          '../helper/loaders/hot-update.js',
        ),
        options: this.updateOptions,
        enforce: 'pre',
      });
      options.target ??= 'node';
      options.resolve ??= {
        extensions: ['.jsx', '.tsx', '.js', '.ts', '.json'],
        extensionAlias: {
          '.js': ['.ts', '.js'],
          '.jsx': ['.tsx', '.jsx'],
          '.mjs': ['.mts', '.mjs'],
        },
      };
      options.plugins ??= [];
      options.plugins.push(
        // @ts-expect-error RspackPluginInstance or WebpackPluginInstance
        new bundler.HotModuleReplacementPlugin(),
        new TestHotUpdatePlugin(this.updateOptions),
      );
      if (compilerType === ECompilerType.Webpack) {
        const webpackCaseOptions = options as TCompilerOptions<
          ECompilerType.Webpack
        >;
        webpackCaseOptions.recordsPath ??= path.join(dist, 'records.json');
      }
    },
  };
}

export interface IRspeedyHotProcessorOptions<T extends ECompilerType> {
  compilerType: T;
  bundler: TImportedBundler;
  caseOptions: TCompilerOptions<T>;
  name: string;
  src: string;
  dist: string;
  cwd: string;
}

export class RspeedyHotProcessor<T extends ECompilerType>
  extends HotProcessor<T>
{
  constructor(options: IRspeedyHotProcessorOptions<T>) {
    super({
      ...createHotOptions(options),
      name: options.name,
      compilerType: options.compilerType,
      target: 'node',
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
          new RspeedyHotProcessor<ECompilerType>({
            bundler,
            caseOptions,
            src,
            dist: compilerDist,
            cwd,
            name: caseName,
            compilerType,
          }),
        );
      });
    }
  });
}

export function hotCases(suite: ITestSuite): void {
  const distPath = path.resolve(suite.casePath, '../js/hot');
  rimrafSync(distPath);
  describeByWalk(suite.name, (name, src, dist) => {
    createCase(name, src, dist, suite.casePath);
  }, {
    source: suite.casePath,
    dist: distPath,
    describe,
  });
}
