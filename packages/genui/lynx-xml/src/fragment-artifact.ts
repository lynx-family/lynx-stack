// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { parse } from 'acorn';
import { simple } from 'acorn-walk';
import { analyze } from 'eslint-scope';

import { generateMainThreadScriptResult } from './html-fragment.js';

/** Compile the model's intermediate document without executing model code. */
export function compileLynxXmlFragment(source: string): {
  text: string;
  xmlFragment: string;
} {
  const root = /^\s*<!doctype lynx>\s*<lynx\b[^>]*>/u.exec(source);
  if (!root) {
    throw new Error(
      'Fragment document requires a <!doctype lynx> document with a <lynx> root',
    );
  }
  let offset = root[0].length;
  let templateStart = -1;
  let templateEnd = -1;
  let xmlFragment: string | undefined;
  let mainStart = -1;
  let mainEnd = -1;
  // Scan root children in source order, skipping raw JS/CSS bodies as units.
  // A template-looking string inside a script must never become a fragment.
  const blocks =
    /\s*(<template\s*>|<style>|<script thread="(main|background)">|<!--)/gy;
  blocks.lastIndex = offset;
  let block: RegExpExecArray | null;
  while ((block = blocks.exec(source))) {
    const opening = block[1]!;
    let closeTag = '</script>';
    if (opening === '<!--') closeTag = '-->';
    else if (opening === '<style>') closeTag = '</style>';
    else if (opening.startsWith('<template')) closeTag = '</template>';
    const end = source.indexOf(closeTag, blocks.lastIndex);
    if (end === -1) {
      throw new Error('Fragment document contains an unclosed source block');
    }
    if (closeTag === '</template>') {
      if (xmlFragment !== undefined) {
        throw new Error(
          'Fragment document must contain exactly one <template>',
        );
      }
      xmlFragment = source.slice(blocks.lastIndex, end);
      templateStart = blocks.lastIndex - opening.length;
      templateEnd = end + closeTag.length;
    }
    if (block[2] === 'main') {
      if (mainStart !== -1) {
        throw new Error(
          'Fragment document must contain exactly one main-thread script',
        );
      }
      mainStart = blocks.lastIndex;
      mainEnd = end;
    }
    blocks.lastIndex = end + closeTag.length;
    offset = blocks.lastIndex;
  }
  if (source.slice(offset).trim() !== '</lynx>' || mainStart === -1) {
    throw new Error(
      'Fragment document requires complete template/style/script blocks and exactly one main-thread script',
    );
  }
  if (xmlFragment === undefined) {
    throw new Error(
      'Fragment mode requires one <template> directly inside <lynx>; the model omitted the XML fragment',
    );
  }
  const generated = generateMainThreadScriptResult(xmlFragment);

  const javascript = source.slice(mainStart, mainEnd);
  const ast = parse(javascript, {
    ecmaVersion: 2022,
    sourceType: 'script',
    ranges: true,
  });
  const scopes = analyze(ast, { ecmaVersion: 2022, sourceType: 'script' });
  if (scopes.scopes.some(scope => scope.set.has('createFragment'))) {
    throw new Error(
      'createFragment is provided by the server and must not be declared or shadowed',
    );
  }
  let calls = 0;
  simple(ast, {
    CallExpression(node) {
      if (
        node.callee.type === 'Identifier'
        && node.callee.name === 'createFragment'
      ) {
        if (node.arguments.length !== 2) {
          throw new Error(
            'Call createFragment(page, pageId) with two arguments',
          );
        }
        calls++;
      }
    },
  });
  if (calls !== 1) {
    throw new Error(
      'Fragment document must call createFragment(page, pageId) exactly once',
    );
  }

  const factory =
    `\nfunction createFragment(page, pageId) {\n${generated.javascript}\nreturn nodeMap;\n}\n`;
  // Append a hoisted declaration, preserving directive prologues and eager rendering.
  // Apply edits from right to left so either template/script order is valid.
  const edits = [
    { start: templateStart, end: templateEnd, text: '' },
    { start: mainEnd, end: mainEnd, text: factory },
  ].sort((left, right) => right.start - left.start);
  let text = source;
  for (const edit of edits) {
    text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
  }
  return { text, xmlFragment };
}
