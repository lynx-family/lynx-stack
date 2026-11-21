// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

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

test('exposes packages multiple factories without replacing host sections', async () => {
  const { compilation, encode } = inlineCompilation({
    exposes: {
      first: { source, parse: parseLynxXML },
      second: { source, parse: parseLynxXML },
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
    output: { mode: 'inline', entry: 'details' },
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
