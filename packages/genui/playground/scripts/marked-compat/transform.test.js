// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';

import { test } from '@rstest/core';

import loader from './loader.cjs';
import { transformMarked } from './transform.cjs';

const require = createRequire(import.meta.url);

const packageFile = require.resolve('marked/package.json');
const filename = path.join(path.dirname(packageFile), 'lib/marked.esm.js');
const source = fs.readFileSync(filename, 'utf8');
const { version } = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
const patched = transformMarked(source, version, filename);

// Model the missing constructor feature only. Real PrimJS validation is still
// required; regex literals are transformed separately by the Lynx compiler.
const withoutPropertyEscapes = new Proxy(RegExp, {
  construct(target, args) {
    if (/\\p\{/i.test(String(args[0])) && /[uv]/.test(args[1] ?? '')) {
      throw new SyntaxError('Unicode property escapes are unavailable');
    }
    return Reflect.construct(target, args);
  },
});

function load(code, RegExpConstructor) {
  const exportStart = code.lastIndexOf('\nexport {');
  assert.notEqual(exportStart, -1);
  const context = RegExpConstructor ? { RegExp: RegExpConstructor } : {};
  vm.runInNewContext(
    code.slice(0, exportStart) + '\nglobalThis.lexer = _Lexer;',
    context,
    { timeout: 5000 },
  );
  return context.lexer;
}

function tokens(lexer, input, options) {
  const result = lexer.lex(input, { ...options });
  return JSON.stringify({ tokens: result, links: result.links });
}

test('loads without dynamic Unicode properties, where original Marked fails', () => {
  assert.throws(() => load(source, withoutPropertyEscapes), /property escapes/);
  assert.doesNotThrow(() => load(patched.code, withoutPropertyEscapes));
});

test('preserves tokens for Markdown and every streaming prefix', () => {
  const original = load(source);
  const compatible = load(patched.code, withoutPropertyEscapes);
  const samples = [
    '',
    '# 标题\n\n正文',
    '**中文**，*强调*。',
    'foo_bar_baz',
    'a***b***c',
    '￥**价格**💰',
    '😀_emoji_🧑‍💻',
    '𠀀**扩展汉字**𠮷',
    '> 引用\n> **加粗**',
    '- a\n  - b\n- [x] done',
    '| 列1 | 列2 |\n| :--- | ---: |\n| 中 | 文 |',
    '[链接](https://example.com "标题")',
    '![图片](a.png)',
    '[引用][id]\n\n[id]: https://example.com "标题"',
    '`a*b`\n\n```js\nconst a = 1;\n```',
    '~~删除~~ www.example.com',
    '转义\\*星号\\* &amp;',
    '<b>html</b>',
    'a\u0301**组合字符**，b',
    'a\r\n\r\n---\r\n',
  ];
  for (const options of [{ gfm: true }, { gfm: false }, { pedantic: true }]) {
    for (const sample of samples) {
      for (let end = 0; end <= sample.length; end++) {
        const prefix = sample.slice(0, end);
        assert.equal(
          tokens(compatible, prefix, options),
          tokens(original, prefix, options),
          JSON.stringify({ prefix, options }),
        );
      }
    }
  }
});

test('preserves all five rule patterns including captures and supplementary characters', () => {
  const original = load(source).rules.inline.normal;
  const compatible =
    load(patched.code, withoutPropertyEscapes).rules.inline.normal;
  const names = [
    'punctuation',
    'emStrongLDelim',
    'emStrongRDelimAst',
    'emStrongRDelimUnd',
    'anyPunctuation',
  ];
  for (const name of names) {
    const before = original[name];
    const after = compatible[name];
    assert.match(before.source, /\\p\{/);
    assert.doesNotMatch(after.source, /\\p\{/i);
    assert.equal(after.flags, before.flags);
    for (
      const character of [
        'a',
        ' ',
        '。',
        '￥',
        '💰',
        '😀',
        '𠀀',
        '*',
        '_',
        '\\',
      ]
    ) {
      for (
        const text of [
          character,
          `*${character}`,
          `${character}**a**`,
          `_${character}_`,
          `\\${character}`,
        ]
      ) {
        before.lastIndex = after.lastIndex = 0;
        assert.equal(
          JSON.stringify(after.exec(text)),
          JSON.stringify(before.exec(text)),
          `${name}: ${text}`,
        );
        assert.equal(after.lastIndex, before.lastIndex);
      }
    }
  }
});

test('fails closed on dependency upgrades, source drift and double patching', () => {
  assert.throws(
    () => transformMarked(source, '14.1.0', filename),
    /requires 14.0.0/,
  );
  assert.throws(
    () =>
      transformMarked(
        source.replaceAll('_punctuation', '_changed'),
        version,
        filename,
      ),
    /exactly one/,
  );
  assert.throws(
    () => transformMarked(source + source, version, filename),
    /exactly one/,
  );
  assert.throws(
    () => transformMarked(patched.code, version, filename),
    /exactly one/,
  );
});

test('loader tracks the package version and supplies a source map', () => {
  const dependencies = [];
  let output;
  loader.call({
    resourcePath: filename,
    addDependency(file) {
      dependencies.push(file);
    },
    callback(error, code, map) {
      assert.equal(error, null);
      output = { code, map };
    },
  }, source);
  assert.deepEqual(dependencies, [packageFile]);
  assert.equal(output.code, patched.code);
  assert.deepEqual(output.map.sourcesContent, [source]);
  assert.equal(output.map.sources.length, 1);
  assert.ok(output.map.mappings.length > 0);
  assert.equal(fs.readFileSync(filename, 'utf8'), source);
});
