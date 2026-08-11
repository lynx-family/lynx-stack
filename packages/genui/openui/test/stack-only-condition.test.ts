// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { rspack } from '@rspack/core';
import type { Configuration, Stats } from '@rspack/core';
import { expect, test } from '@rstest/core';

const OPENUI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_PACKAGE_ROOT = resolve(OPENUI_ROOT, '..');

test('the default preset continues to register all built-ins', async () => {
  const source = await readFile(
    join(OPENUI_ROOT, 'dist', 'core', 'defaultComponents.js'),
    'utf8',
  );
  const componentArray = /DEFAULT_COMPONENTS\s*=\s*\[([\s\S]*?)\];/.exec(
    source,
  )?.[1];

  if (!componentArray) {
    throw new Error('The default component array was not found.');
  }
  expect(
    [...componentArray.matchAll(/\bc\.(\w+)/g)].map(
      match => match[1],
    ),
  ).toEqual([
    'Stack',
    'Row',
    'Column',
    'List',
    'Card',
    'CardHeader',
    'Text',
    'TextContent',
    'Separator',
    'Divider',
    'Button',
    'Buttons',
    'Tag',
    'Image',
    'Icon',
    'Video',
    'AudioPlayer',
    'Loading',
    'Tabs',
    'Modal',
    'CheckBox',
    'RadioGroup',
    'ChoicePicker',
    'Slider',
    'TextField',
    'DateTimeInput',
  ]);
});

test('the Stack-only condition excludes the default catalog graph', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'genui-openui-condition-'));

  try {
    await createPublicPackageFixture(fixtureRoot);

    const defaultModules = await compileFixture(fixtureRoot, [
      'import',
      'require',
      'node',
    ]);
    const stackOnlyModules = await compileFixture(
      fixtureRoot,
      ['lynx-openui-stack-only', 'import', 'require', 'node'],
      'stack-only',
    );

    expect(defaultModules.some(path => path.endsWith('/Icon/index.jsx')))
      .toBe(true);
    expect(defaultModules.some(path => path.endsWith('/material-icons.css')))
      .toBe(true);
    expect(defaultModules.some(path => path.endsWith('/defaultComponents.js')))
      .toBe(true);

    expect(
      stackOnlyModules
        .filter(path => path.includes('/openui/dist/catalog/'))
        .map(path => path.slice(path.indexOf('/catalog/') + 9))
        .sort(),
    ).toEqual(['Stack/index.jsx', 'utils.js']);
    expect(stackOnlyModules.some(path => path.includes('material-icons.css')))
      .toBe(false);
    expect(stackOnlyModules.some(path => path.includes('@lynx-js/lynx-ui')))
      .toBe(false);
    expect(
      stackOnlyModules.some(path =>
        path.endsWith('/defaultComponents.stack.js')
      ),
    ).toBe(true);
    expect(
      stackOnlyModules.some(path => path.endsWith('/defaultComponents.js')),
    )
      .toBe(false);
  } finally {
    await rm(fixtureRoot, { force: true, recursive: true });
  }
});

async function createPublicPackageFixture(fixtureRoot: string): Promise<void> {
  const packageRoot = join(
    fixtureRoot,
    'node_modules',
    '@lynx-js',
    'genui',
  );
  await mkdir(packageRoot, { recursive: true });
  await copyFile(
    join(PUBLIC_PACKAGE_ROOT, 'package.json'),
    join(packageRoot, 'package.json'),
  );
  await copyDirectory(
    join(PUBLIC_PACKAGE_ROOT, 'openui', 'dist'),
    join(packageRoot, 'openui', 'dist'),
  );
  await copyDirectory(
    join(PUBLIC_PACKAGE_ROOT, 'openui', 'styles'),
    join(packageRoot, 'openui', 'styles'),
  );
  await writeFile(
    join(fixtureRoot, 'entry.mjs'),
    `import { createOpenUiLibrary } from '@lynx-js/genui/openui';\n`
      + `globalThis.library = createOpenUiLibrary();\n`,
  );
}

async function copyDirectory(
  source: string,
  destination: string,
): Promise<void> {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const sourcePath = join(source, entry.name);
    const destinationPath = join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath);
    } else {
      await copyFile(sourcePath, destinationPath);
    }
  }
}

async function compileFixture(
  fixtureRoot: string,
  conditionNames: string[],
  outputName = 'default',
): Promise<string[]> {
  const stats = await runCompiler({
    context: fixtureRoot,
    mode: 'development',
    devtool: false,
    entry: './entry.mjs',
    target: 'node',
    output: {
      path: join(fixtureRoot, `dist-${outputName}`),
      filename: 'main.cjs',
    },
    resolve: {
      conditionNames,
      modules: [join(fixtureRoot, 'node_modules')],
    },
    module: {
      rules: [
        {
          test: /\.jsx$/,
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: { syntax: 'ecmascript', jsx: true },
              transform: {
                react: {
                  runtime: 'automatic',
                  importSource: '@lynx-js/react',
                },
              },
            },
          },
        },
        { test: /\.css$/, type: 'asset/source' },
      ],
    },
    optimization: { concatenateModules: false },
    externals: [
      ({ request }, callback) => {
        if (
          request
          && !request.startsWith('.')
          && !request.startsWith('#')
          && !isAbsolute(request)
          && !request.startsWith('@lynx-js/genui')
        ) {
          callback(undefined, `commonjs ${request}`);
          return;
        }
        callback();
      },
    ],
  });

  if (stats.hasErrors()) {
    throw new Error(stats.toString({ all: false, errors: true }));
  }

  return [...stats.compilation.modules].map(module => {
    const resource = module.nameForCondition?.();
    return String(resource ?? module.identifier()).replaceAll('\\', '/');
  });
}

function runCompiler(config: Configuration): Promise<Stats> {
  const compiler = rspack(config);

  return new Promise((resolvePromise, reject) => {
    compiler.run((error, stats) => {
      compiler.close(closeError => {
        const finalError = error ?? closeError;
        if (finalError) {
          reject(finalError);
        } else if (stats) {
          resolvePromise(stats);
        } else {
          reject(new Error('Rspack completed without stats.'));
        }
      });
    });
  });
}
