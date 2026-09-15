// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { join } from 'node:path';

import ts from 'typescript';

export interface RsbuildOption {
  default?: string;
}

const MAX_DEPTH = 4;
const RSBUILD_TYPES = `${join('node_modules', '@rsbuild', 'core')}`;

export function rsbuildConfigOptions(
  root: string,
): Record<string, RsbuildOption> {
  const dir = join(root, 'packages/rspeedy/core');
  const file = join(dir, 'src', '__rsbuild_config__.ts');
  const source =
    'import type { RsbuildConfig } from \'@rsbuild/core\';\nexport type Target = RsbuildConfig;\n';
  const configPath = join(dir, 'tsconfig.json');
  const parsed = ts.parseJsonConfigFileContent(
    ts.readConfigFile(configPath, p => ts.sys.readFile(p)).config,
    ts.sys,
    dir,
  );
  const host = ts.createCompilerHost(parsed.options);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const getSourceFile = host.getSourceFile.bind(host);
  host.readFile = f => (f === file ? source : readFile(f));
  host.fileExists = f => f === file || fileExists(f);
  host.getSourceFile = (f, lang, ...rest) =>
    f === file
      ? ts.createSourceFile(f, source, lang)
      : getSourceFile(f, lang, ...rest);
  const options: ts.CompilerOptions = { ...parsed.options, noEmit: true };
  delete options['plugins'];
  const program = ts.createProgram([file], options, host);
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(file);
  let target: ts.Type | undefined;
  if (sf) {
    ts.forEachChild(sf, n => {
      if (ts.isTypeAliasDeclaration(n)) {
        target = checker.getTypeAtLocation(n.name);
      }
    });
  }
  const out: Record<string, RsbuildOption> = {};
  const fromRsbuild = (d: ts.Declaration) =>
    d.getSourceFile().fileName.includes(RSBUILD_TYPES);
  const visit = (
    type: ts.Type,
    prefix: string,
    depth: number,
    seen: ReadonlySet<ts.Type>,
  ) => {
    const t = checker.getNonNullableType(type);
    const parts = t.isUnion() ? t.types : [t];
    for (const part of parts) {
      if (
        seen.has(part) || part.getCallSignatures().length > 0
        || checker.isArrayType(part)
        || (!(part.flags & ts.TypeFlags.Object) && !part.isIntersection())
      ) continue;
      for (const p of part.getProperties()) {
        const decl = p.valueDeclaration ?? p.declarations?.[0];
        if (!decl || !fromRsbuild(decl)) continue;
        const path = prefix ? `${prefix}.${p.name}` : p.name;
        const tag = p.getJsDocTags(checker).find(x => x.name === 'default');
        const text = tag?.text
          ? ts.displayPartsToString(tag.text).trim()
          : undefined;
        out[path] ??= text ? { default: text } : {};
        if (depth < MAX_DEPTH) {
          visit(
            checker.getTypeOfSymbolAtLocation(p, decl),
            path,
            depth + 1,
            new Set([...seen, part]),
          );
        }
      }
    }
  };
  if (target) visit(target, '', 1, new Set());
  return Object.fromEntries(
    Object.entries(out).sort(([a], [b]) => a.localeCompare(b)),
  );
}
