// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Keeps the source text of functions that a plugin injects into cards by
// stringifying them (`Template.getFunctionContent(fn)`, that is
// `fn.toString()`). Applied to the files of `STRINGIFIED` in build.mjs.
//
// Bundling the kit rewrites such a function: Rspack renames identifiers it
// owns (`__webpack_require__` becomes `__nested_rspack_require_<n>_<m>__`),
// and a minifier would rename the rest. The card then gets the rewritten
// text. So every top-level function of these modules gets an own `toString`
// that returns its text as published, which is what `fn.toString()` gives in
// Node.js. The functions themselves are left as they are; nothing calls them.
//
// The text is a string literal, which neither renaming nor minification
// changes. `Function.prototype.toString.call(fn)` bypasses the override, so
// this covers callers that use `fn.toString()`, `String(fn)` or `${fn}`.

const { readFileSync } = require('node:fs');

const { parse } = require('acorn');

/** @this {import('@rspack/core').LoaderContext<unknown>} */
module.exports = function verbatimFunctionsLoader(source) {
  const file = this.resourcePath;
  // The text must be the published one, not what an earlier loader made of it.
  if (source !== readFileSync(file, 'utf-8')) {
    throw new Error(
      `${file}: another loader changed this module before verbatim-functions-loader`,
    );
  }
  const ast = parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    allowHashBang: true,
  });

  // Top-level functions: `function f() {}`, `export function f() {}` and
  // `export default function () {}`.
  const functions = [];
  for (const node of ast.body) {
    let declaration = node;
    if (
      node.type === 'ExportNamedDeclaration'
      || node.type === 'ExportDefaultDeclaration'
    ) {
      declaration = node.declaration;
    }
    if (declaration?.type !== 'FunctionDeclaration') continue;
    functions.push(declaration);
  }
  if (functions.length === 0) {
    throw new Error(
      `${file} is listed in STRINGIFIED but declares no top-level function`,
    );
  }

  let result = source;
  const trailer = [];
  for (const declaration of functions.reverse()) {
    const text = source.slice(declaration.start, declaration.end);
    let name = declaration.id?.name;
    if (!name) {
      // `export default function () {}` has no binding to attach to: give the
      // declaration one. This changes `fn.name`, not the text returned below.
      name = '__web_bundle_kit_default__';
      // Only whitespace or comments separate `function` (or `function*`)
      // from the parameters, so the name goes right before `(`.
      const at = source.indexOf('(', declaration.start);
      result = `${result.slice(0, at)} ${name}${result.slice(at)}`;
    }
    trailer.push(
      `Object.defineProperty(${name}, 'toString', { value: function toString() { return ${
        JSON.stringify(text)
      }; }, configurable: true, writable: true });`,
    );
  }
  return `${result}\n// Added by web-bundle-kit: the published text of the functions above.\n${
    trailer.reverse().join('\n')
  }\n`;
};
