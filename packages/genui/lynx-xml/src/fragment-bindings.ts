// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { parse } from 'acorn';
import { full } from 'acorn-walk';
import { analyze } from 'eslint-scope';

/** Resolve undeclared XML-id references without changing user-defined bindings. */
export function resolveFragmentBindings(
  javascript: string,
  bindings: Readonly<Record<string, string>>,
  declarations = '',
): string {
  const parseOptions = {
    ecmaVersion: 2022,
    sourceType: 'script',
    ranges: true,
  } as const;
  let ast = parse(javascript, parseOptions);
  if (declarations) {
    // Keep directives first, including those terminated by automatic semicolons.
    let offset = 0;
    for (const statement of ast.body) {
      if (
        statement.type !== 'ExpressionStatement' || !('directive' in statement)
      ) break;
      offset = statement.end;
    }
    const prefix = javascript.slice(0, offset);
    const terminator = offset > 0 && !prefix.endsWith(';') ? ';' : '';
    javascript = `${prefix}${terminator}\n${declarations}\n${
      javascript.slice(offset)
    }`;
    ast = parse(javascript, parseOptions);
  }
  const scopes = analyze(ast, {
    ecmaVersion: 2022,
    sourceType: 'script',
    optimistic: true,
  });
  const globalScope = scopes.globalScope;
  if (!globalScope) return javascript;

  // Shorthand keys must retain their public name, including destructuring.
  const shorthandOffsets = new Set<number>();
  full(ast, node => {
    if (node.type === 'Property' && node.shorthand) {
      shorthandOffsets.add(node.value.start);
    }
  });
  const edits = new Map<number, { end: number; text: string }>();
  for (const reference of globalScope.through) {
    const { identifier } = reference;
    if (!Object.hasOwn(bindings, identifier.name)) continue;
    const target = bindings[identifier.name]!;
    // Bind only to generated, script-scoped nodes. A local nodeN declaration
    // would capture a rewritten reference and silently update the wrong node.
    let scope = reference.from;
    while (scope.upper && !scope.set.has(target)) scope = scope.upper;
    if (scope !== globalScope || !globalScope.set.has(target)) {
      throw new Error(
        `XML id "${identifier.name}" cannot reference shadowed or missing node "${target}"`,
      );
    }
    const range = identifier.range;
    if (!range) {
      throw new Error('Fragment binding reference is missing its range');
    }
    const [start, end] = range;
    edits.set(start, {
      end,
      text: shorthandOffsets.has(start)
        ? `${javascript.slice(start, end)}: ${target}`
        : target,
    });
  }
  let resolved = javascript;
  for (const [start, { end, text }] of [...edits].sort(([a], [b]) => b - a)) {
    resolved = resolved.slice(0, start) + text + resolved.slice(end);
  }
  return resolved;
}
