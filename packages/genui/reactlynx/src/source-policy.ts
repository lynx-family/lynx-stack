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
      throw new Error('App.tsx may only import @lynx-js/react');
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
