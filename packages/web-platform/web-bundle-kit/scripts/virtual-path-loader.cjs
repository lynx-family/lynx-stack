// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Tells a bundled module where it lives in the kit's virtual `node_modules`
// tree: `import.meta.url`, `import.meta.dirname` and `import.meta.filename`
// are replaced with the virtual location, and CommonJS modules get
// `__filename` and `__dirname`. See layout.mjs.
//
// The replacement works on the syntax tree, so code that only mentions
// `import.meta.url` in a string (Rsbuild generates such code) is left alone.

const { parse } = require('acorn');

const META = /\bimport\.meta\b/;

function findImportMeta(source) {
  let ast;
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
  const found = [];
  const visit = (node) => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!node || typeof node.type !== 'string') return;
    if (
      node.type === 'MemberExpression'
      && !node.computed
      && node.object.type === 'MetaProperty'
      && node.object.meta.name === 'import'
      && ['url', 'dirname', 'filename'].includes(node.property.name)
    ) {
      found.push({ start: node.start, end: node.end, key: node.property.name });
      return;
    }
    for (const key of Object.keys(node)) {
      if (key !== 'type' && key !== 'start' && key !== 'end') visit(node[key]);
    }
  };
  visit(ast);
  return found;
}

/** @this {import('@rspack/core').LoaderContext<unknown>} */
module.exports = function virtualPathLoader(source) {
  // Set by build.mjs, which runs this loader in its own process.
  const { toVirtual, isCommonJS } = globalThis.__webBundleKitBuild;
  const file = this.resourcePath;
  const usesMeta = META.test(source);
  const usesDirname = isCommonJS(file)
    && /\b__dirname\b|\b__filename\b/.test(source);
  if (!usesMeta && !usesDirname) return source;

  const virtualFile = toVirtual(file);
  if (virtualFile === undefined) {
    this.emitWarning(
      new Error(
        `${file} uses its own location but its package is not in the virtual node_modules tree`,
      ),
    );
    return source;
  }
  const virtualDir = virtualFile.slice(0, virtualFile.lastIndexOf('/')) || '/';
  const values = {
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
};
