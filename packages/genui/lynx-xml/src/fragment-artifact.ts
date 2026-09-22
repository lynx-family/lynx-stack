// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { parse } from 'acorn';
import { simple } from 'acorn-walk';
import { analyze } from 'eslint-scope';

import { generateMainThreadScriptResult } from './html-fragment.js';
import { generateSharedScript } from './script-reuse.js';
import { generatePresetStyles, validateStylePreset } from './style-preset.js';
import type { LynxXmlStylePreset } from './style-preset.js';

/** Optional script and styling assembly applied during fragment conversion. */
export interface CompileLynxXmlFragmentOptions {
  /**
   * Assemble shared lifecycle and event helpers around definePage callbacks.
   * @defaultValue false
   * @example { enableScriptReuse: true }
   */
  enableScriptReuse?: boolean | undefined;
  /** Inject used Lynx utility styles. Disabled when omitted or false. */
  stylePreset?: LynxXmlStylePreset | false | undefined;
}

/** Options for deterministic assembly of a model-authored Lynx XML document. */
export interface AssembleLynxXmlArtifactOptions
  extends CompileLynxXmlFragmentOptions
{
  /**
   * Compile a root-child template into Element PAPI.
   * @defaultValue false
   */
  enableHtmlFragment?: boolean | undefined;
}

/** Assemble enabled template, script, and style features without executing model code. */
export function assembleLynxXmlArtifact(
  source: string,
  options: AssembleLynxXmlArtifactOptions = {},
): { text: string; xmlFragment?: string } {
  return transformLynxXmlArtifact(
    source,
    options.enableHtmlFragment === true,
    options,
  );
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
  if (enableTemplate || options.enableScriptReuse) {
    const scopes = analyze(ast, { ecmaVersion: 2022, sourceType: 'script' });
    if (
      enableTemplate
      && scopes.scopes.some(scope => scope.set.has('createFragment'))
    ) {
      throw new Error(
        'createFragment is provided by the server and must not be declared or shadowed',
      );
    }
    if (
      options.enableScriptReuse
      && scopes.scopes.some(scope => scope.set.has('definePage'))
    ) {
      throw new Error(
        'definePage is provided by the agent and must not be declared or shadowed',
      );
    }
  }
  if (options.enableScriptReuse) {
    const registrations = ast.body.filter(node =>
      node.type === 'ExpressionStatement'
      && node.expression.type === 'CallExpression'
      && node.expression.callee.type === 'Identifier'
      && node.expression.callee.name === 'definePage'
    );
    const registration = registrations[0];
    if (
      registrations.length !== 1
      || registration?.type !== 'ExpressionStatement'
      || registration.expression.type !== 'CallExpression'
      || registration.expression.arguments.length !== 1
      || registration.expression.arguments[0]?.type !== 'ObjectExpression'
    ) {
      throw new Error(
        'ScriptReuse requires one top-level definePage({...}) call',
      );
    }
    const hooks = registration.expression.arguments[0].properties;
    const hookNames = new Set<string>();
    for (const hook of hooks) {
      let name: unknown;
      if (hook.type === 'Property' && !hook.computed) {
        if (hook.key.type === 'Identifier') name = hook.key.name;
        else if (hook.key.type === 'Literal') name = hook.key.value;
      }
      if (
        typeof name !== 'string'
        || !['render', 'update', 'destroy'].includes(name)
        || hookNames.has(name) || hook.type !== 'Property'
        || hook.kind !== 'init'
        || !['FunctionExpression', 'ArrowFunctionExpression', 'Identifier']
          .includes(hook.value.type)
        || ((hook.value.type === 'FunctionExpression'
          || hook.value.type === 'ArrowFunctionExpression')
          && (hook.value.async || hook.value.generator))
      ) {
        throw new Error(
          'definePage accepts unique synchronous render, update, and destroy hooks only',
        );
      }
      hookNames.add(name);
    }
    if (
      !enableTemplate && !hookNames.has('render')
    ) {
      throw new Error('ScriptReuse without Template requires a render hook');
    }
  }
  let calls = 0;
  let pageDefinitions = 0;
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
      if (options.enableScriptReuse) {
        if (
          node.callee.type === 'Identifier' && node.callee.name === 'definePage'
        ) pageDefinitions++;
        if (
          (node.callee.type === 'Identifier'
            && ['__CreatePage', 'createFragment'].includes(node.callee.name))
          || (node.callee.type === 'MemberExpression'
            && node.callee.object.type === 'Identifier'
            && node.callee.object.name === 'lynx'
            && ((node.callee.property.type === 'Identifier'
              && node.callee.property.name === 'getEngine')
              || (node.callee.property.type === 'Literal'
                && node.callee.property.value === 'getEngine')))
        ) {
          throw new Error(
            'ScriptReuse owns page creation, createFragment, and engine lifecycle registration',
          );
        }
      }
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
  if (options.enableScriptReuse && pageDefinitions !== 1) {
    throw new Error('ScriptReuse requires exactly one definePage call');
  }
  if (enableTemplate && !options.enableScriptReuse && calls !== 1) {
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
      {
        start: mainEnd,
        end: mainEnd,
        text: factory + (options.enableScriptReuse
          ? generateSharedScript(enableTemplate)
          : ''),
      },
    );
  } else if (options.enableScriptReuse) {
    edits.push({
      start: mainEnd,
      end: mainEnd,
      text: generateSharedScript(false),
    });
  }
  const presetCss = [
    options.enableScriptReuse
      ? '.genui-page { display: flex; flex-direction: column; }'
      : '',
    options.stylePreset ? generatePresetStyles(classNames) : '',
  ].filter(Boolean).join('\n');
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
