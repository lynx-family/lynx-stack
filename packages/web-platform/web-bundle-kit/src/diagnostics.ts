// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Diagnostic } from './types.js';

/** The fields of an Rspack stats error or warning the kit reads. */
export interface StatsDiagnostic {
  message: string;
  moduleIdentifier?: string | undefined;
  moduleName?: string | undefined;
  loc?: string | undefined;
  file?: string | undefined;
}

/** The project-relative path of an absolute or `./`-relative path in `root`. */
function toProjectPath(root: string, file: string): string | undefined {
  // Drop the loaders of a module identifier and the query of a resource.
  // and the layer (`|react:background`) Rspack appends to an identifier.
  const resource = file.slice(file.lastIndexOf('!') + 1).split('?')[0]!.split(
    '|',
  )[0]!;
  if (resource.startsWith(`${root}/`)) return resource.slice(root.length + 1);
  if (resource.startsWith('./')) return resource.slice(2);
  return undefined;
}

// `12:5`, `12:5-9` or `12:5-14:2`; Rspack's stats columns are 1-based.
const LOC = /^(\d+):(\d+)/;
// The code frame of SWC and Rspack: `╭─[/project/src/App.tsx:3:6]`, with a
// 0-based column.
const FRAME = /[╭┌]─\[\s*([^\]\s]+?):(\d+):(\d+)\s*\]/;
// `/project/src/App.tsx:3:7` or `(3:7)` after a path.
const PATH_LINE = (root: string) =>
  new RegExp(
    `${
      root.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
    }/([^\\s:()'"]+):(\\d+):(\\d+)`,
  );

/**
 * Maps an Rspack diagnostic to the kit's {@link Diagnostic}. Paths in it
 * become project-relative; `line` and `column` are 1-based.
 */
export function toDiagnostic(root: string, input: StatsDiagnostic): Diagnostic {
  const diagnostic: Diagnostic = { message: input.message };
  const file =
    (input.moduleIdentifier && toProjectPath(root, input.moduleIdentifier))
      ?? (input.moduleName && toProjectPath(root, input.moduleName))
      ?? (input.file && toProjectPath(root, input.file));
  if (file) diagnostic.file = file;

  const loc = input.loc && LOC.exec(input.loc);
  if (loc) {
    diagnostic.line = Number(loc[1]);
    diagnostic.column = Number(loc[2]);
    return diagnostic;
  }

  const frame = FRAME.exec(input.message);
  if (frame) {
    const framed = toProjectPath(root, frame[1]!);
    if (
      framed && (diagnostic.file === undefined || diagnostic.file === framed)
    ) {
      diagnostic.file = framed;
      diagnostic.line = Number(frame[2]);
      diagnostic.column = Number(frame[3]) + 1;
      return diagnostic;
    }
  }

  const inline = PATH_LINE(root).exec(input.message);
  if (
    inline && (diagnostic.file === undefined || diagnostic.file === inline[1])
  ) {
    diagnostic.file = inline[1]!;
    diagnostic.line = Number(inline[2]);
    diagnostic.column = Number(inline[3]);
  }
  return diagnostic;
}
