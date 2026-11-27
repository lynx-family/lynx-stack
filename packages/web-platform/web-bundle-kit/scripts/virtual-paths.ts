// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Tells a bundled module where it lives in the kit's virtual `node_modules`
// tree: `import.meta.url`, `import.meta.dirname` and `import.meta.filename`
// are replaced with the virtual location, and CommonJS modules get
// `__filename` and `__dirname`. See layout.ts.
//
// The replacement works on the syntax tree, so code that only mentions
// `import.meta.url` in a string (Rsbuild generates such code) is left alone.

import { parse } from 'acorn';
import type { MemberExpression, Node } from 'acorn';

import { isCommonJS } from './layout.ts';
import type { Layout } from './layout.ts';

const META = /\bimport\.meta\b/;
const KEYS = ['url', 'dirname', 'filename'] as const;
type Key = typeof KEYS[number];

interface Found {
  start: number;
  end: number;
  key: Key;
}

function findImportMeta(source: string): Found[] {
  let ast: Node;
  try {
    ast = parse(source, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      allowHashBang: true,
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
    });
  } catch {
    // Not a module (CommonJS with `with`, octal literals, ...): no import.meta.
    return [];
  }
  const found: Found[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const child of value) visit(child);
      return;
    }
    if (
      !value || typeof value !== 'object'
      || typeof (value as Node).type !== 'string'
    ) {
      return;
    }
    const node = value as Node & Record<string, unknown>;
    if (node.type === 'MemberExpression') {
      const member = node as unknown as MemberExpression;
      if (
        !member.computed
        && member.object.type === 'MetaProperty'
        && member.object.meta.name === 'import'
        && member.property.type === 'Identifier'
        && (KEYS as readonly string[]).includes(member.property.name)
      ) {
        found.push({
          start: member.start,
          end: member.end,
          key: member.property.name as Key,
        });
        return;
      }
    }
    for (const key of Object.keys(node)) {
      if (key !== 'type' && key !== 'start' && key !== 'end') visit(node[key]);
    }
  };
  visit(ast);
  return found;
}

/**
 * Returns `source`, the code of `file`, with its virtual location in place of
 * `import.meta.*` and `__dirname` / `__filename`. Returns `undefined` when
 * the module uses its location but its package is not in the layout.
 */
export function setVirtualLocation(
  source: string,
  file: string,
  layout: Layout,
): string | undefined {
  const usesMeta = META.test(source);
  const usesDirname = /\b__dirname\b|\b__filename\b/.test(source)
    && isCommonJS(file);
  if (!usesMeta && !usesDirname) return source;

  const virtualFile = layout.toVirtual(file);
  if (virtualFile === undefined) return undefined;
  const virtualDir = virtualFile.slice(0, virtualFile.lastIndexOf('/')) || '/';
  const values: Record<Key, string> = {
    url: JSON.stringify(`file://${virtualFile}`),
    dirname: JSON.stringify(virtualDir),
    filename: JSON.stringify(virtualFile),
  };

  let result = source;
  if (usesMeta) {
    for (const { start, end, key } of findImportMeta(source).reverse()) {
      result = result.slice(0, start) + values[key] + result.slice(end);
    }
  }
  if (usesDirname) {
    result =
      `var __filename = ${values.filename}, __dirname = ${values.dirname};\n${result}`;
  }
  return result;
}
