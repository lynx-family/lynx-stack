// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import ts from 'typescript';

export function validateReactLynxAppSource(source: string): void {
  const ast = ts.createSourceFile(
    'App.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const validate = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && (!ts.isStringLiteral(node.moduleSpecifier)
        || node.moduleSpecifier.text !== '@lynx-js/react')
    ) {
      const specifier = node.moduleSpecifier;
      const request = ts.isStringLiteral(specifier)
        ? specifier.text
        : specifier.getText(ast);
      const { line, character } = ast.getLineAndCharacterOfPosition(
        specifier.getStart(ast),
      );
      const guidance = request === './App.css'
        ? 'Remove this import; the host imports App.css automatically.'
        : (request === 'react'
          ? 'Import ReactLynx hooks and types from @lynx-js/react instead.'
          : 'Keep components and helpers in App.tsx without importing other modules.');
      throw new Error(
        `App.tsx:${line + 1}:${
          character + 1
        }: App.tsx may only import @lynx-js/react; unsupported module ${
          JSON.stringify(request)
        }. ${guidance}`,
      );
    }
    if (
      ts.isImportEqualsDeclaration(node) || ts.isMetaProperty(node)
      || node.kind === ts.SyntaxKind.ImportKeyword
      || (ts.isIdentifier(node)
        && ['require', 'module', '__webpack_require__'].includes(node.text))
    ) {
      throw new Error('Dynamic modules and import.meta are not supported');
    }
    ts.forEachChild(node, validate);
  };
  validate(ast);
}
