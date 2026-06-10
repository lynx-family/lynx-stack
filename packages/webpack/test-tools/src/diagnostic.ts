// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';

import type { RspackOptions, Stats } from '@rspack/core';
import { BasicCaseCreator, describeByWalk } from '@rspack/test-tools';
import type {
  ITestContext,
  ITestEnv,
  ITestProcessor,
} from '@rspack/test-tools';
import { normalizePlaceholder } from '@rspack/test-tools/helper/expect/placeholder';

import { getOptions } from './suite.js';
import type { ITestSuite } from './suite.js';

const TARGET = 'node' as const;

function lynxDefaultOptions(
  context: ITestContext,
  cwd: string,
): RspackOptions {
  return {
    context: cwd,
    entry: context.getSource(),
    mode: 'none',
    target: TARGET,
    output: {
      publicPath: '/',
      path: context.getDist(),
      filename: 'bundle.js',
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
}

function createDiagnosticProcessor(
  name: string,
  src: string,
  cwd: string,
): ITestProcessor {
  return {
    config: async (context) => {
      const compiler = context.getCompiler();
      const defaultOptions = lynxDefaultOptions(context, cwd);
      const caseOptions = await getOptions<RspackOptions>(
        path.join(src, 'rspack.config.js'),
      );
      const options = Object.assign(
        defaultOptions,
        caseOptions,
      );
      options.target = TARGET;
      compiler.setOptions(options);
    },
    compiler: (context) => {
      context.getCompiler().createCompiler();
    },
    build: async (context) => {
      await context.getCompiler().build();
    },
    run: () => {
      // Diagnostic cases never execute the bundle; only the build is inspected.
    },
    check: async (env: ITestEnv, context) => {
      const stats = context.getCompiler().getStats() as Stats | null;
      if (!stats) {
        throw new Error(`Stats should exist for ${name}`);
      }
      // `ITestEnv['expect']` is the unresolved `Expect` type from
      // `@rspack/test-tools`, so it lands as `error`-typed; narrow it to a
      // minimal callable to keep the assertion type-safe.
      const expect = env.expect as (
        value: unknown,
      ) => { toBe(v: unknown): void };
      expect(stats.hasErrors() || stats.hasWarnings()).toBe(true);

      let output = stats.toString({
        all: false,
        errors: true,
        warnings: true,
      })
        .replaceAll('│', '')
        .split(/\r?\n/)
        .map((s) => s.trim())
        // Drop stack-trace frames (`at …`): they reference environment-dependent
        // paths (`<ROOT>` resolves to the package cwd locally but the monorepo
        // root in CI; plus @rspack/core internals and `node:internal`) that carry
        // no diagnostic value and make the snapshot non-portable.
        .filter((s) => !s.startsWith('at '))
        .join('\n');
      // Normalize remaining paths/pnpm-inner/`file://` with the same
      // `normalizePlaceholder` the `toMatchFileSnapshotSync` matcher applies, then
      // collapse line:column.
      output = normalizePlaceholder(output).replaceAll(
        /\d+:\d+/g,
        '<LINE:COLUMN>',
      );

      // `toMatchFileSnapshotSync` is registered by
      // `@rspack/test-tools/setup-expect`.
      (env.expect as (value: unknown) => {
        toMatchFileSnapshotSync: (path: string) => void;
      })(output).toMatchFileSnapshotSync(
        context.getSource(`expected/rspack.txt`),
      );
    },
  };
}

const creators = new Map<string, BasicCaseCreator>();

function getCreator(cwd: string): BasicCaseCreator {
  const key = cwd;
  if (!creators.has(key)) {
    creators.set(
      key,
      new BasicCaseCreator({
        clean: true,
        describe: false,
        target: TARGET,
        steps: ({ name, src }) => [
          createDiagnosticProcessor(name, src, cwd),
        ],
        concurrent: true,
      }),
    );
  }
  return creators.get(key)!;
}

export function diagnosticCases(suite: ITestSuite): void {
  const distPath = path.resolve(suite.casePath, '../dist/diagnostic');
  const creator = getCreator(suite.casePath);
  describeByWalk(suite.name, (name, src, dist) => {
    creator.create(name, src, dist);
  }, {
    source: suite.casePath,
    dist: distPath,
  });
}
