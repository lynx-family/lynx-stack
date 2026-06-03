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
import type {
  ITestContext,
  ITestEnv,
  TCompilerOptions,
  TCompilerStatsCompilation,
} from '@rspack/test-tools';
import fs from 'fs-extra';
import { rimrafSync } from 'rimraf';

import { createHotOptions } from './hot.js';
import type { IRspeedyHotProcessorOptions } from './hot.js';
import { createRunner, getOptions } from './suite.js';
import type { ITestSuite, TImportedBundler } from './suite.js';

const describe = (globalThis as unknown as {
  describe: typeof import('@rstest/core').describe;
}).describe;
const test = (globalThis as unknown as {
  test: typeof import('@rstest/core').test;
}).test;

export interface IRspeedyHotSnapshotProcessorOptions<T extends ECompilerType>
  extends IRspeedyHotProcessorOptions<T>
{
  snapshot: string;
  /**
   * Decode the base64 `content` of `*.hot-update.json` manifests into plain,
   * pretty-printed JSON in the snapshot. Opt-in, so existing suites are
   * unaffected.
   *
   * @defaultValue `false`
   */
  decodeHotUpdateManifest?: boolean;
}

class RspeedyHotSnapshotProcessor<T extends ECompilerType>
  extends HotSnapshotProcessor<T>
{
  readonly #decodeHotUpdateManifest: boolean;

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
    this.#decodeHotUpdateManifest = options.decodeHotUpdateManifest ?? false;
  }

  // A `*.css.hot-update.json` manifest carries the re-encoded template in a
  // base64 `content` field. Snapshotting it verbatim turns every page-config
  // change into a giant opaque one-line diff (and the hash normalization below
  // even corrupts the base64). When opted in, decode `content` into plain JSON
  // before normalization (via the `snapshotContent` hook), then pretty-print the
  // manifest blocks so the snapshot is readable and diffs line-by-line.
  protected override matchStepSnapshot(
    env: ITestEnv,
    context: ITestContext,
    step: number,
    stats: TCompilerStatsCompilation<T>,
    runtime?: Parameters<HotSnapshotProcessor<T>['matchStepSnapshot']>[4],
  ): void {
    if (!this.#decodeHotUpdateManifest) {
      super.matchStepSnapshot(env, context, step, stats, runtime);
      return;
    }

    const testConfig = context.getTestConfig();
    // `snapshotContent` is a plain function property, not a bound method.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const previous = testConfig.snapshotContent;
    testConfig.snapshotContent = (content: string) =>
      decodeManifestContent(previous ? previous(content) : content);

    // The base implementation re-serializes the manifest with a compact
    // `JSON.stringify`, so pretty-print the rendered snapshot string (the only
    // seam exposed is `env.expect`). `jest.Expect` is untyped here, hence casts.
    const wrappedEnv: ITestEnv = {
      ...env,
      /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
      expect: ((received: unknown) =>
        env.expect(
          typeof received === 'string'
            ? prettyPrintJsonBlocks(received)
            : received,
        )) as ITestEnv['expect'],
      /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
    };

    try {
      super.matchStepSnapshot(wrappedEnv, context, step, stats, runtime);
    } finally {
      if (previous) {
        testConfig.snapshotContent = previous;
      } else {
        delete testConfig.snapshotContent;
      }
    }
  }
}

/**
 * Decode the base64 `content` of a `*.hot-update.json` manifest into plain JSON
 * so the snapshot is human-readable. Runs through the official `snapshotContent`
 * hook (before hash normalization), so it sees the pristine base64. Non-manifest
 * assets (e.g. a `hot-update.js` bundle) are passed through untouched.
 */
function decodeManifestContent(content: string): string {
  let manifest: { content?: unknown };
  try {
    manifest = JSON.parse(content) as { content?: unknown };
  } catch {
    return content;
  }
  if (manifest && typeof manifest.content === 'string') {
    try {
      manifest.content = JSON.parse(
        Buffer.from(manifest.content, 'base64').toString('utf-8'),
      ) as unknown;
    } catch {
      return content;
    }
    return JSON.stringify(manifest);
  }
  return content;
}

/** Re-indent every ```` ```json ```` block so the decoded manifest diffs line-by-line. */
function prettyPrintJsonBlocks(snapshot: string): string {
  return snapshot.replaceAll(
    /```json\n([\s\S]*?)\n```/g,
    (match, body: string) => {
      try {
        return `\`\`\`json\n${
          JSON.stringify(JSON.parse(body), null, 2)
        }\n\`\`\``;
      } catch {
        return match;
      }
    },
  );
}

function createCase(
  name: string,
  src: string,
  dist: string,
  cwd: string,
  decodeHotUpdateManifest: boolean,
) {
  describe(name, () => {
    for (const compilerType of [ECompilerType.Rspack]) {
      const caseName = `${name} - ${compilerType}`;
      const caseConfigFile = path.join(src, `${compilerType}.config.js`);
      const compilerDist = path.join(dist, compilerType);
      const runner = createRunner(src, compilerDist, HotRunnerFactory);

      // eslint-disable-next-line @typescript-eslint/no-misused-promises
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
            decodeHotUpdateManifest,
          }),
        );
      });
    }
  });
}

export interface IHotSnapshotCasesOptions {
  /**
   * Decode the base64 `content` of `*.hot-update.json` manifests into plain,
   * pretty-printed JSON in the snapshot. Opt-in, so existing suites keep their
   * current (raw base64) snapshots.
   *
   * @defaultValue `false`
   */
  decodeHotUpdateManifest?: boolean;
}

export function hotSnapshotCases(
  suite: ITestSuite,
  options: IHotSnapshotCasesOptions = {},
): void {
  const distPath = path.resolve(suite.casePath, '../js/hot-snapshot');
  rimrafSync(distPath);
  describeByWalk(suite.name, (name, src, dist) => {
    createCase(
      name,
      src,
      dist,
      suite.casePath,
      options.decodeHotUpdateManifest ?? false,
    );
  }, {
    source: suite.casePath,
    dist: distPath,
    describe,
  });
}
