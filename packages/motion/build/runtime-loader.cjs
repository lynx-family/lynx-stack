// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const { transformAsync } = require('@babel/core');

const globals = new Set([
  'document',
  'window',
  'Element',
  'HTMLElement',
  'SVGElement',
  'NodeList',
  'EventTarget',
  'getComputedStyle',
  'performance',
  'queueMicrotask',
]);

function runtimeImports({ types: t }) {
  return {
    visitor: {
      Program(program) {
        const imports = new Map();
        const replacement = (name) => {
          if (!imports.has(name)) {
            imports.set(name, program.scope.generateUidIdentifier(name));
          }
          return t.cloneNode(imports.get(name));
        };
        program.traverse({
          'MemberExpression|OptionalMemberExpression'(path) {
            const { object, property, computed } = path.node;
            if (
              !t.isIdentifier(object, { name: 'globalThis' })
              || path.scope.hasBinding('globalThis', { noGlobals: true })
            ) return;
            const name = computed && t.isStringLiteral(property)
              ? property.value
              : (!computed && t.isIdentifier(property)
                ? property.name
                : undefined);
            if (globals.has(name)) path.replaceWith(replacement(name));
          },
          ReferencedIdentifier(path) {
            const { name } = path.node;
            if (
              globals.has(name)
              && !path.scope.hasBinding(name, { noGlobals: true })
            ) {
              path.replaceWith(replacement(name));
            }
          },
        });
        for (const [name, local] of imports) {
          program.unshiftContainer(
            'body',
            t.importDeclaration(
              [t.importSpecifier(local, t.identifier(name))],
              t.stringLiteral(
                name === 'queueMicrotask'
                  ? 'lynx-motion-microtask'
                  : 'lynx-motion-runtime',
              ),
            ),
          );
        }
      },
    },
  };
}

module.exports = function motionRuntimeLoader(source, inputSourceMap) {
  const callback = this.async();
  transformAsync(source, {
    filename: this.resourcePath,
    babelrc: false,
    configFile: false,
    sourceMaps: true,
    inputSourceMap: inputSourceMap ?? undefined,
    plugins: [runtimeImports],
  }).then(result => callback(null, result.code, result.map), callback);
};
