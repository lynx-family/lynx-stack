// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test } from '@rstest/core';

import {
  DIRECTIVE_INFERENCE_BUILD_INFO,
  collectDirectiveInferenceRecords,
  createDirectiveInferenceReport,
} from '../src/DirectiveInferenceReport.js';
import { LAYERS } from '../src/layer.js';
import {
  extractStaticModuleSources,
  resolveDirectiveInferenceConfig,
} from '../src/loaders/directive-inference.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe('directive-inference package manifests', () => {
  test('extracts sorted static package sources', () => {
    expect(extractStaticModuleSources(`
      import type { Type } from "z-types";
      import receiver, { consume as alias } from "fake-functions";
      import "side-effect-package";
      export { component } from "@scope/widgets/subpath";
      import local from "./local.js";
      const dynamic = import("not-static");
    `)).toEqual([
      '@scope/widgets/subpath',
      'fake-functions',
      'side-effect-package',
      'z-types',
    ]);
  });

  test('resolves inline and sidecar declarations with provenance', () => {
    const project = createProject();
    writePackage(project, 'inline-package', {
      name: 'inline-package',
      version: '1.2.3',
      exports: './index.js',
      lynx: {
        directiveInference: {
          protocolVersion: 1,
          exports: {
            consume: { args: { 0: true } },
          },
        },
      },
    });
    writePackage(
      project,
      '@scope/sidecar',
      {
        name: '@scope/sidecar',
        version: '4.5.6',
        exports: {
          '.': './index.js',
          './components': './components.js',
          './package.json': './package.json',
        },
        lynx: {
          directiveInference: './main-thread.json',
        },
      },
      {
        'main-thread.json': {
          protocolVersion: 1,
          modules: {
            './components': {
              exports: {
                Panel: { props: { callback: true } },
              },
            },
          },
        },
      },
    );

    const dependencies: string[] = [];
    const config = resolveDirectiveInferenceConfig(
      `
        import { consume as renamed } from "inline-package";
        import { Panel } from "@scope/sidecar/components";
      `,
      path.join(project, 'src', 'App.tsx'),
      true,
      filename => dependencies.push(filename),
    );

    expect(config).toEqual({
      protocolVersion: 1,
      modules: [
        {
          exports: {
            Panel: { props: { callback: true } },
          },
          manifest: 'main-thread.json',
          package: '@scope/sidecar',
          packageVersion: '4.5.6',
          source: '@scope/sidecar/components',
        },
        {
          exports: {
            consume: { args: { 0: true } },
          },
          manifest: 'package.json#lynx.directiveInference',
          package: 'inline-package',
          packageVersion: '1.2.3',
          source: 'inline-package',
        },
      ],
    });
    expect(dependencies.map(filename => path.basename(filename)).sort())
      .toEqual(['main-thread.json', 'package.json', 'package.json']);
  });

  test('merges explicit declarations and supports global disable', () => {
    const project = createProject();
    writePackage(project, 'fake-package', {
      name: 'fake-package',
      version: '1.0.0',
      exports: './index.js',
      lynx: {
        directiveInference: {
          protocolVersion: 1,
          exports: {
            consume: { args: { 0: true } },
          },
        },
      },
    });
    const source = 'import { consume } from "fake-package";';
    const resource = path.join(project, 'src', 'App.tsx');

    expect(resolveDirectiveInferenceConfig(source, resource, false))
      .toBeUndefined();
    expect(resolveDirectiveInferenceConfig(source, resource, {
      declarations: {
        protocolVersion: 1,
        modules: [{
          source: 'fake-package',
          package: 'configured-package',
          exports: {
            Panel: { props: { callback: true } },
          },
        }],
      },
    })).toEqual({
      protocolVersion: 1,
      modules: [{
        source: 'fake-package',
        package: 'configured-package',
        packageVersion: '1.0.0',
        manifest: 'package.json#lynx.directiveInference',
        exports: {
          consume: { args: { 0: true } },
          Panel: { props: { callback: true } },
        },
      }],
    });
  });
});

describe('directive-inference report', () => {
  const first = {
    filename: 'src/App.tsx',
    start: 20,
    end: 30,
    package: 'fake-package',
    packageVersion: '1.0.0',
    manifest: 'main-thread.json',
    source: 'fake-package',
    export: 'consume',
    path: 'args.0',
  };
  const second = {
    ...first,
    start: 5,
    end: 10,
    path: 'props.callback',
  };

  test('deduplicates and sorts identical dual-compilation records', () => {
    const modules = [
      {
        layer: LAYERS.MAIN_THREAD,
        buildInfo: {
          [DIRECTIVE_INFERENCE_BUILD_INFO]: [first, second],
        },
      },
      {
        layer: LAYERS.BACKGROUND,
        buildInfo: {
          [DIRECTIVE_INFERENCE_BUILD_INFO]: [first, second],
        },
      },
    ];

    expect(
      createDirectiveInferenceReport(
        collectDirectiveInferenceRecords(modules),
      ),
    ).toEqual({
      protocolVersion: 1,
      sites: [second, first],
    });
  });

  test('rejects non-deterministic dual compilation', () => {
    const modules = [
      {
        layer: LAYERS.MAIN_THREAD,
        buildInfo: {
          [DIRECTIVE_INFERENCE_BUILD_INFO]: [first],
        },
      },
      {
        layer: LAYERS.BACKGROUND,
        buildInfo: {
          [DIRECTIVE_INFERENCE_BUILD_INFO]: [second],
        },
      },
    ];

    expect(() =>
      createDirectiveInferenceReport(
        collectDirectiveInferenceRecords(modules),
      )
    ).toThrow(/not deterministic across main-thread and background/);
  });

  test('rejects a record missing from one compilation layer', () => {
    const modules = [
      {
        layer: LAYERS.MAIN_THREAD,
        buildInfo: {
          [DIRECTIVE_INFERENCE_BUILD_INFO]: [first],
        },
      },
      {
        layer: LAYERS.BACKGROUND,
        buildInfo: {
          [DIRECTIVE_INFERENCE_BUILD_INFO]: [],
        },
      },
    ];

    expect(() =>
      createDirectiveInferenceReport(
        collectDirectiveInferenceRecords(modules),
      )
    ).toThrow(/not deterministic across main-thread and background/);
  });

  test('inherits parent layers and rejects a nested one-layer mismatch', () => {
    const modules = [
      {
        layer: LAYERS.MAIN_THREAD,
        modules: [{
          buildInfo: {
            [DIRECTIVE_INFERENCE_BUILD_INFO]: [first],
          },
        }],
      },
      {
        layer: LAYERS.BACKGROUND,
        modules: [{
          buildInfo: {
            [DIRECTIVE_INFERENCE_BUILD_INFO]: [],
          },
        }],
      },
    ];

    expect(() =>
      createDirectiveInferenceReport(
        collectDirectiveInferenceRecords(modules),
      )
    ).toThrow(/not deterministic across main-thread and background/);
  });
});

function createProject(): string {
  const project = fs.mkdtempSync(
    path.join(os.tmpdir(), 'directive-inference-'),
  );
  temporaryDirectories.push(project);
  fs.mkdirSync(path.join(project, 'src'), { recursive: true });
  fs.writeFileSync(path.join(project, 'src', 'App.tsx'), '');
  return project;
}

function writePackage(
  project: string,
  packageName: string,
  packageJson: Record<string, unknown>,
  files: Record<string, unknown> = {},
): void {
  const directory = path.join(project, 'node_modules', packageName);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, 'package.json'),
    JSON.stringify(packageJson),
  );
  fs.writeFileSync(path.join(directory, 'index.js'), '');
  fs.writeFileSync(path.join(directory, 'components.js'), '');
  for (const [filename, value] of Object.entries(files)) {
    fs.writeFileSync(path.join(directory, filename), JSON.stringify(value));
  }
}
