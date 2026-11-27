// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import { createRsbuild } from '@rsbuild/core';

import { parseLynxXML } from '@lynx-js/lynx-xml/parser';
import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';

import { pluginIslands } from '../lib/build/index.js';

const rootPath = fileURLToPath(new URL('../../../', import.meta.url));
const source = 'examples/react-lynx-xml/xml/card.lynxml';

function sourceCompilation(context, content) {
  const directory = mkdtempSync(join(tmpdir(), 'lynx-islands-parser-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const source = join(directory, 'card.lynxml');
  writeFileSync(source, content);
  return inlineCompilation({
    exposes: { card: { source, parse: parseLynxXML } },
  });
}

async function sectionsFor(context, content) {
  const { encode } = sourceCompilation(context, content);
  const result = await encode({
    chunkGroups: [{ name: 'main' }],
    encodeData: { customSections: {} },
  });
  return result.encodeData.customSections;
}

function inlineCompilation(options) {
  const config = {};
  const compilation = { fileDependencies: new Set() };
  const plugin = pluginIslands(options);
  plugin.setup({
    context: { rootPath },
    modifyRspackConfig(callback) {
      callback(config, { environment: { name: 'lynx' } });
    },
  });
  config.plugins[0].apply({
    hooks: {
      thisCompilation: {
        tap(_name, callback) {
          callback(compilation);
        },
      },
    },
  });
  return {
    compilation,
    encode: args =>
      LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation).beforeEncode
        .promise(args),
  };
}

function applyRspackConfig(options, context = {}) {
  const config = { entry: { main: './src/index.tsx' } };
  const plugin = pluginIslands(options);
  plugin.setup({
    context: { rootPath, action: context.action ?? 'build' },
    modifyRspackConfig(callback) {
      callback(config, {
        environment: context.environment ?? { name: 'lynx', config: {} },
      });
    },
  });
  return config;
}

test('exposes packages multiple factories without replacing host sections', async () => {
  const { compilation, encode } = inlineCompilation({
    exposes: {
      first: source,
      second: { source },
    },
  });
  const hostSection = { content: 'host-script' };
  const args = {
    chunkGroups: [{ name: 'main' }],
    encodeData: { customSections: { host: hostSection } },
  };
  const result = await encode(args);
  const sections = result.encodeData.customSections;
  assert.equal(sections.host, hostSection);
  assert.deepEqual(Object.keys(sections), [
    'host',
    'first/main',
    'first/background',
    'first/css',
    'second/main',
    'second/background',
    'second/css',
  ]);
  assert.equal(compilation.fileDependencies.size, 1);
  const module = runInNewContext(sections['first/main'].content);
  assert.equal(typeof module.create, 'function');
  assert.equal(module.render, undefined);
  assert.ok(
    sections['first/css'].content.ruleList.some(rule =>
      rule.type === 'StyleRule' && rule.selectorText.value === '.XmlCard'
    ),
  );
});

test('inline output respects its host entry and rejects duplicate exposes', async () => {
  const { encode } = inlineCompilation({
    exposes: { card: { source, parse: parseLynxXML } },
    entry: 'details',
  });
  const args = {
    chunkGroups: [{ name: 'main' }],
    encodeData: { customSections: {} },
  };
  await encode(args);
  assert.deepEqual(args.encodeData.customSections, {});
  args.chunkGroups[0].name = 'details';
  await encode(args);
  assert.ok(args.encodeData.customSections['card/main']);
  await assert.rejects(encode(args), /Duplicate island custom section/);
});

test('dev reload prepends a hot invalidation module to the host entry', () => {
  const config = applyRspackConfig(
    { exposes: { card: source } },
    {
      action: 'dev',
      environment: { name: 'lynx', config: { dev: { hmr: true } } },
    },
  );
  assert.equal(Object.keys(config.entry).length, 1);
  const imports = config.entry.main.import;
  assert.equal(imports.length, 2);
  assert.match(imports[0], /__lynx-islands\.[a-f0-9]{16}\.hot\.js$/);
  assert.equal(imports[1], './src/index.tsx');
});

test('dev reload preserves object entry configuration', () => {
  const config = {
    entry: {
      details: { import: ['./src/details.ts'], layer: 'react:background' },
    },
  };
  const plugin = pluginIslands({ exposes: { card: source }, entry: 'details' });
  plugin.setup({
    context: { rootPath, action: 'dev' },
    modifyRspackConfig(callback) {
      callback(config, {
        environment: { name: 'lynx', config: { dev: { hmr: false } } },
      });
    },
  });
  assert.equal(config.entry.details.layer, 'react:background');
  assert.match(
    config.entry.details.import[0],
    /__lynx-islands\.[a-f0-9]{16}\.hot\.js$/,
  );
  assert.equal(config.entry.details.import[1], './src/details.ts');
});

test('dev reload is skipped when hmr and live reload are disabled', () => {
  const config = applyRspackConfig(
    { exposes: { card: source } },
    {
      action: 'dev',
      environment: {
        name: 'lynx',
        config: { dev: { hmr: false, liveReload: false } },
      },
    },
  );
  assert.equal(config.entry.main, './src/index.tsx');
});

test('build rejects missing or empty public expose names', () => {
  assert.throws(() => pluginIslands({ exposes: {} }), /expose name/);
  assert.throws(
    () =>
      pluginIslands({
        exposes: { '': { source, parse: parseLynxXML } },
      }),
    /expose name/,
  );
});

for (
  const filename of [
    '',
    '/cards.lynx.bundle',
    '../cards.lynx.bundle',
    'cards\\file.bundle',
    'https://example.test/cards.bundle',
  ]
) {
  test(`rejects invalid remote asset filename ${JSON.stringify(filename)}`, () => {
    assert.throws(() =>
      pluginIslands({
        exposes: { card: source },
        output: { mode: 'remote', filename },
      }), /relative asset path/);
  });
}

test('resource-only Rsbuild producer encodes without a React plugin or app entry', async context => {
  const directory = mkdtempSync(join(tmpdir(), 'lynx-islands-remote-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const encoded = [];
  const rsbuild = await createRsbuild({
    cwd: directory,
    rsbuildConfig: {
      environments: { lynx: {} },
      plugins: [
        pluginIslands({
          exposes: {
            first: join(rootPath, source),
            second: join(rootPath, source),
          },
          output: { mode: 'remote', filename: 'assets/cards.lynx.bundle' },
        }),
        {
          name: 'test:island-encoding',
          setup(api) {
            api.modifyRspackConfig(config => {
              config.plugins.push({
                apply(compiler) {
                  compiler.hooks.thisCompilation.tap(
                    'test:record-assets',
                    compilation => {
                      compilation.hooks.processAssets.tap({
                        name: 'test:record-assets',
                        stage: compiler.webpack.Compilation
                          .PROCESS_ASSETS_STAGE_REPORT,
                      }, () => {
                        encoded.push(...compilation.getAssets());
                      });
                    },
                  );
                },
              });
            });
          },
        },
      ],
    },
  });
  await rsbuild.build();
  assert.deepEqual(encoded.map(asset => asset.name), [
    'assets/cards.lynx.bundle',
  ]);
  const asset = encoded[0];
  assert.ok(asset.source.size() > 0);
  // The native decoder validates the emitted binary, not a stub encoder.
  const require = createRequire(
    import.meta.resolve('@lynx-js/template-webpack-plugin'),
  );
  const tasm = await import(require.resolve('@lynx-js/tasm'));
  const decoded = tasm.supportNapi()
    ? tasm.decode_napi(Buffer.from(asset.source.buffer()))
    : await tasm.decode_wasm(Buffer.from(asset.source.buffer()));
  assert.ok(decoded);
  assert.ok(JSON.stringify(decoded).includes('first/main'));
  assert.ok(JSON.stringify(decoded).includes('second/background'));
});

test('shared parser preserves scripts and handles absent optional sections', async context => {
  const main =
    'module.exports = { create() { return { value: "<literal>" }; } };';
  const minimal =
    `<lynx engine-version="4.2"><script thread="main">${main}</script></lynx>`;
  const minimalSections = await sectionsFor(context, minimal);
  assert.equal(
    runInNewContext(minimalSections['card/main'].content).create().value,
    '<literal>',
  );
  assert.deepEqual(minimalSections['card/css'].content.ruleList, []);
  assert.equal(typeof minimalSections['card/background'].content, 'string');

  const background = 'const original = "A & B";';
  const complete =
    `<lynx engine-version="4.2"><style></style><script thread="main">${main}</script><script thread="background">${background}</script></lynx>`;
  const completeSections = await sectionsFor(context, complete);
  assert.ok(completeSections['card/main'].content.includes(main));
  assert.ok(completeSections['card/background'].content.includes(background));
  assert.deepEqual(completeSections['card/css'].content.ruleList, []);
});

test('XML failures preserve the shared parser offset and include the input path', context => {
  const source = '<lynx engine-version="4.2"><style></style></lynx>';
  const result = parseLynxXML(source);
  assert.equal(result.success, false);
  assert.throws(() => sourceCompilation(context, source), error => {
    assert.match(error.message, /card\.lynxml:/);
    assert.ok(error.message.endsWith(result.error.formattedMessage));
    return true;
  });
});

test('raw CSS preserves declarations, font faces, and keyframes', async context => {
  const source = `<lynx engine-version="4.2">
<style>
.card { color: red; }
@font-face { font-family: "Card"; src: url("https://example.test/font.ttf"); }
@keyframes pulse { from { opacity: 0; } to { opacity: 1; } }
</style>
<script thread="main">module.exports = { create() {} };</script>
</lynx>`;
  const sections = await sectionsFor(context, source);
  const rules = sections['card/css'].content.ruleList;
  assert.deepEqual(rules.map(rule => rule.type), [
    'StyleRule',
    'FontFaceRule',
    'KeyframesRule',
  ]);
  assert.equal(rules[0].style[0].name, 'color');
  assert.equal(rules[0].style[0].value, 'red');
});

for (
  const style of [
    '@media (min-width: 10px) { .card { color: red; } }',
    '@supports (display: grid) { .card { display: grid; } }',
    '@layer cards { .card { color: red; } }',
    '@property --accent { syntax: "<color>"; inherits: false; initial-value: red; }',
    '@import url("theme.css");',
  ]
) {
  test(`build rejects CSS that cannot be packaged: ${style.split(' ')[0]}`, context => {
    const source =
      `<lynx engine-version="4.2"><style>${style}</style><script thread="main">module.exports = {};</script></lynx>`;
    assert.throws(
      () => sourceCompilation(context, source),
      /card\.lynxml: Island CSS has unsupported at-rules:/,
    );
  });
}

test('serializer diagnostics fail the build rather than dropping invalid CSS', context => {
  const source =
    `<lynx engine-version="4.2"><style>@keyframes incomplete;</style><script thread="main">module.exports = {};</script></lynx>`;
  assert.throws(
    () => sourceCompilation(context, source),
    /Invalid island CSS: illegal keyframes/,
  );
});
