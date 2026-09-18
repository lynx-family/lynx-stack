// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { parse } from 'acorn';
import { simple } from 'acorn-walk';
import { analyze } from 'eslint-scope';

import { generateMainThreadScriptResult } from './html-fragment.js';
import { generatePresetStyles, validateStylePreset } from './style-preset.js';
import type { LynxXmlStylePreset } from './style-preset.js';

/** Optional styling applied during runtime fragment conversion. */
export interface CompileLynxXmlFragmentOptions {
  /** Inject used Lynx utility styles. Disabled when omitted or false. */
  stylePreset?: LynxXmlStylePreset | false | undefined;
}

/** Compile the model's intermediate document without executing model code. */
export function compileLynxXmlFragment(
  source: string,
  options: CompileLynxXmlFragmentOptions = {},
): {
  text: string;
  xmlFragment: string;
} {
  const result = transformLynxXmlArtifact(source, true, options);
  return { text: result.text, xmlFragment: result.xmlFragment! };
}

/** Inject preset CSS into a direct Element PAPI document without changing scripts. */
export function applyLynxXmlStylePreset(
  source: string,
  stylePreset: LynxXmlStylePreset = 'default',
): string {
  return transformLynxXmlArtifact(source, false, { stylePreset }).text;
}

function transformLynxXmlArtifact(
  source: string,
  enableTemplate: boolean,
  options: CompileLynxXmlFragmentOptions,
): { text: string; xmlFragment?: string } {
  validateStylePreset(options.stylePreset);
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
  const styles: { start: number; end: number; content: string }[] = [];
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
    if (opening === '<style>') {
      styles.push({
        start: blocks.lastIndex - opening.length,
        end: end + closeTag.length,
        content: source.slice(blocks.lastIndex, end),
      });
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
  if (enableTemplate && xmlFragment === undefined) {
    throw new Error(
      'Fragment mode requires one <template> directly inside <lynx>; the model omitted the XML fragment',
    );
  }
  if (!enableTemplate && xmlFragment !== undefined) {
    throw new Error(
      'Enable Template to compile a document containing <template>',
    );
  }
  const generated = xmlFragment === undefined
    ? undefined
    : generateMainThreadScriptResult(xmlFragment);
  const classNames = new Set(generated?.classNames);

  const javascript = source.slice(mainStart, mainEnd);
  const ast = parse(javascript, {
    ecmaVersion: 2022,
    sourceType: 'script',
    ranges: true,
  });
  if (enableTemplate) {
    const scopes = analyze(ast, { ecmaVersion: 2022, sourceType: 'script' });
    if (scopes.scopes.some(scope => scope.set.has('createFragment'))) {
      throw new Error(
        'createFragment is provided by the server and must not be declared or shadowed',
      );
    }
  }
  let calls = 0;
  simple(ast, {
    Literal(node) {
      if (options.stylePreset && typeof node.value === 'string') {
        for (const name of node.value.split(/\s+/u)) classNames.add(name);
      }
    },
    TemplateElement(node) {
      if (options.stylePreset) {
        for (const name of (node.value.cooked ?? '').split(/\s+/u)) {
          classNames.add(name);
        }
      }
    },
    CallExpression(node) {
      if (
        enableTemplate && node.callee.type === 'Identifier'
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
  if (enableTemplate && calls !== 1) {
    throw new Error(
      'Fragment document must call createFragment(page, pageId) exactly once',
    );
  }

  // Append a hoisted declaration, preserving directive prologues and eager rendering.
  // Apply edits from right to left so either template/script order is valid.
  const edits: { start: number; end: number; text: string }[] = [];
  if (generated) {
    const factory =
      `\nfunction createFragment(page, pageId) {\n${generated.javascript}\nreturn nodeMap;\n}\n`;
    edits.push(
      { start: templateStart, end: templateEnd, text: '' },
      { start: mainEnd, end: mainEnd, text: factory },
    );
  }
  const presetCss = options.stylePreset ? generatePresetStyles(classNames) : '';
  // TemplateBundle XML permits only one style section. Keep preset rules first
  // and authored rules in source order so their cascade remains intact.
  const firstStyle = styles[0];
  if (firstStyle && (presetCss || styles.length > 1)) {
    const css = (presetCss ? `${presetCss}\n` : '')
      + styles.map(style => style.content).join('\n');
    edits.push({
      start: firstStyle.start,
      end: firstStyle.end,
      text: `<style>${css}</style>`,
    });
    for (const style of styles.slice(1)) {
      edits.push({ start: style.start, end: style.end, text: '' });
    }
  } else if (presetCss) {
    edits.push({
      start: root[0].length,
      end: root[0].length,
      text: `\n<style>\n${presetCss}\n</style>\n`,
    });
  }
  edits.sort((left, right) => right.start - left.start);
  let text = source;
  for (const edit of edits) {
    text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
  }
  return { text, ...(xmlFragment === undefined ? {} : { xmlFragment }) };
}
