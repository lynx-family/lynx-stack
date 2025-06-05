/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import path from 'node:path';

export function getFullPath(
  projectRoot: string,
  filename: string,
  importStmt: string,
): string {
  let fullPath = '';
  if (importStmt.startsWith('/')) {
    fullPath = path.join(projectRoot, importStmt);
  } else if (importStmt.startsWith('@')) {
    fullPath = importStmt;
  } else {
    fullPath = path.resolve(filename, '..', importStmt);
  }

  return fullPath;
}

export function generateHref(
  projectRoot: string,
  filename: string,
  origin: string,
): string {
  filename = path.isAbsolute(filename)
    ? filename
    : path.join(projectRoot, filename);
  const fullPath = getFullPath(projectRoot, filename, origin);

  let projectPath = path.relative(projectRoot, fullPath);

  if (fullPath.startsWith('@')) {
    return normalizeSlashes(fullPath);
  } else if (!projectPath.startsWith('.')) {
    projectPath = path.join(path.sep, projectPath);
  }

  return normalizeSlashes(projectPath);
}

function normalizeSlashes(file: string) {
  return file.replaceAll(path.win32.sep, '/');
}
