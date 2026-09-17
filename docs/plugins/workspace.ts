// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DOCS = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ROOT = join(DOCS, '..');
export const CONTENT = join(DOCS, 'content');
export const LOCALES = ['en', 'zh'] as const;

export type Locale = typeof LOCALES[number];

export interface WorkspacePackage {
  name: string;
  dir: string;
  description?: string;
}

interface PnpmProject {
  name?: string;
  path: string;
  private?: boolean;
}

/**
 * The packages this repository publishes, read from the pnpm workspace.
 */
export function publicPackages(): WorkspacePackage[] {
  const projects = JSON.parse(
    execSync('pnpm list --recursive --depth -1 --json', {
      cwd: ROOT,
      encoding: 'utf8',
    }),
  ) as PnpmProject[];
  return projects
    .filter(project => project.name && project.private !== true)
    .map(project => {
      const { description } = JSON.parse(
        readFileSync(join(project.path, 'package.json'), 'utf8'),
      ) as { description?: string };
      return {
        name: project.name!,
        dir: project.path,
        ...description ? { description } : {},
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Whether the package documents an API: its own `typedoc.json`, or the default
 * `src/index.ts` of a package that publishes types.
 */
export function hasEntryPoint(dir: string): boolean {
  if (existsSync(join(dir, 'typedoc.json'))) return true;
  const { types, typings, exports } = JSON.parse(
    readFileSync(join(dir, 'package.json'), 'utf8'),
  ) as { types?: string; typings?: string; exports?: unknown };
  return existsSync(join(dir, 'src/index.ts'))
    && Boolean(
      types ?? typings ?? JSON.stringify(exports ?? {}).includes('"types"'),
    );
}
