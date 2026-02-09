// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '../src');
const entryPoint = path.join(rootDir, 'mini/index.ts');
const forbiddenFile = path.join(rootDir, 'animation/index.ts');

describe('Dependency Check', () => {
  it('mini should not depend on animation/index.ts or shared runtime', () => {
    const visited = new Set<string>();

    function check(file: string, pathStack: string[]) {
      if (visited.has(file)) {
        return;
      }
      visited.add(file);

      // Resolve file path
      let filePath = file;
      if (!fs.existsSync(filePath)) {
        const extensions = ['.ts', '.js'];
        for (const ext of extensions) {
          if (fs.existsSync(file + ext)) {
            filePath = file + ext;
            break;
          }
        }
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.ts');
      }

      if (!fs.existsSync(filePath)) {
        // console.warn(`File not found: ${file} (dep of ${pathStack[pathStack.length-1]})`);
        return;
      }

      if (file === forbiddenFile) {
        throw new Error(
          `Forbidden dependency found: ${
            [...pathStack, file].map((p) => path.relative(rootDir, p)).join(
              ' -> ',
            )
          }`,
        );
      }

      const content = fs.readFileSync(filePath, 'utf-8');

      // AST Parsing
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true,
      );

      // Recursive node visitor
      function visit(node: ts.Node) {
        // Check for forbidden syntax: import ... with { runtime: 'shared' }
        if (ts.isImportDeclaration(node)) {
          if (
            node.attributes?.elements?.some(el =>
              el.name.text === 'runtime'
              && ts.isStringLiteral(el.value)
              && el.value.text === 'shared'
            )
          ) {
            throw new Error(
              `Forbidden syntax "runtime: 'shared'" found in ${
                path.relative(rootDir, filePath)
              }\nTrace: ${
                [...pathStack, file].map((p) => path.relative(rootDir, p)).join(
                  ' -> ',
                )
              }`,
            );
          }
        }

        // Collect imports
        let importPath: string | null = null;

        if (ts.isImportDeclaration(node)) {
          if (ts.isStringLiteral(node.moduleSpecifier)) {
            importPath = node.moduleSpecifier.text;
          }
        } else if (ts.isExportDeclaration(node)) {
          if (
            node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
          ) {
            importPath = node.moduleSpecifier.text;
          }
        } else if (
          ts.isCallExpression(node)
          && node.expression.kind === ts.SyntaxKind.ImportKeyword
        ) {
          // Dynamic import('...')
          const arg = node.arguments[0];
          if (arg && ts.isStringLiteral(arg)) {
            importPath = arg.text;
          }
        }

        if (importPath && importPath.startsWith('.')) {
          const resolvedPath = path.resolve(path.dirname(filePath), importPath);
          const cleanPath = resolvedPath.replace(/\.js$/, '');
          check(cleanPath, [...pathStack, filePath]);
        }

        ts.forEachChild(node, visit);
      }

      visit(sourceFile);
    }

    check(entryPoint, []);
  });
});
