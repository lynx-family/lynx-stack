// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';

import {
  DiagnosticProcessor,
  ECompilerType,
  describeByWalk,
  getSimpleProcessorRunner,
} from '@rspack/test-tools';
import type {
  ITestContext,
  ITestEnv,
  TCompilerOptions,
} from '@rspack/test-tools';
import fs from 'fs-extra';
import { createSnapshotSerializer } from 'path-serializer';
import { rimrafSync } from 'rimraf';

import { createRstestEnv, getOptions } from './suite.js';
import type { ITestSuite } from './suite.js';

const describe = (globalThis as unknown as {
  describe: typeof import('@rstest/core').describe;
}).describe;
const expect = (globalThis as unknown as {
  expect: typeof import('@rstest/core').expect;
}).expect;
const it = (globalThis as unknown as {
  it: typeof import('@rstest/core').it;
}).it;

class RspeedyDiagnosticProcessor<Compiler extends ECompilerType>
  extends DiagnosticProcessor<Compiler>
{
  override async check(_: ITestEnv, context: ITestContext): Promise<void> {
    const compiler = this.getCompiler(context);
    const stats = compiler.getStats();
    if (!stats) {
      throw new Error('Stats should exists');
    }

    expect(stats.hasErrors() || stats.hasWarnings()).toBe(true);

    let jsonStats = stats.toString({
      all: false,
      errors: true,
      warnings: true,
    });

    if (typeof this._diagnosticOptions.format === 'function') {
      jsonStats = this._diagnosticOptions.format(jsonStats);
    }

    await expect(jsonStats).toMatchFileSnapshot(path.resolve(
      context.getSource(this._diagnosticOptions.snapshot),
    ));
  }
}

const serializer = createSnapshotSerializer({
  features: {
    addDoubleQuotes: false,
    escapeDoubleQuotes: false,
  },
  afterSerialize(val) {
    return val.replaceAll(/\d+:\d+/g, '<LINE:COLUMN>');
  },
});

function createCase(name: string, src: string, dist: string, cwd: string) {
  describe(name, () => {
    const runner = getSimpleProcessorRunner(src, dist, {
      env: createRstestEnv,
    });

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
      return Object.assign(defaultOptions, caseOptions);
    }

    for (const compilerType of [ECompilerType.Rspack, ECompilerType.Webpack]) {
      const caseName = `${name} - ${compilerType}`;
      const caseConfigFile = path.join(src, `${compilerType}.config.js`);

      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      describe.runIf(fs.existsSync(caseConfigFile))(caseName, async () => {
        const caseOptions = await createOptions<ECompilerType>(caseConfigFile);
        it('should have error or warning', async () => {
          await runner(
            caseName,
            new RspeedyDiagnosticProcessor<ECompilerType>({
              snapshotErrors: './raw-error.err',
              snapshotWarning: './raw-warning.err',
              defaultOptions: () => caseOptions,
              overrideOptions: (_, options) => {
                options.output ??= {};
                options.output.filename = `${compilerType}.bundle.js`;
                if (compilerType === ECompilerType.Webpack) {
                  options.output.pathinfo = 'verbose';
                  options.target = 'node';
                }
              },
              name: caseName,
              snapshot: `./expected/${compilerType}.txt`,
              compilerType,
              format: (output: string) => {
                if (compilerType === ECompilerType.Rspack) {
                  output = output
                    .replaceAll('│', '')
                    .split(/\r?\n/)
                    .map((s: string) => s.trim())
                    .join('\n');
                }
                return serializer.serialize(output);
              },
            }),
          );
        }, 30000);
      });
    }
  });
}

export function diagnosticCases(suite: ITestSuite): void {
  const distPath = path.resolve(suite.casePath, '../dist/diagnostic');
  rimrafSync(distPath);
  describeByWalk(suite.name, (name, src, dist) => {
    createCase(name, src, dist, suite.casePath);
  }, {
    source: suite.casePath,
    dist: distPath,
    describe,
  });
}
