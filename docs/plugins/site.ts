// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { join } from 'node:path';

import { lynxStackSections } from './sections.ts';
import type { Section } from './sections.ts';
import { DOCS, ROOT } from './workspace.ts';
import type { WorkspacePackage } from './workspace.ts';

/**
 * What the reference takes from the repository it is generated for. Another
 * repository reuses the plugins by passing its own to
 * {@link pluginApiReference}.
 */
export interface Site {
  /** The package the pages, the dictionary and the manifest are written to. */
  docs: string;
  /** The root of the workspace the packages are read from. */
  root: string;
  /** Where the source of a package is browsed. */
  repository: string;
  /** The branch the source and changelog links point at. */
  branch: string;
  /** Where a published package is browsed. */
  packagePage: (name: string) => string;
  /** The route of every package that has a section of its own, by name. */
  ownSections: Record<string, string>;
  /** The groups the packages are listed under, by directory prefix. */
  groups: { name: string; dirs: string[] }[];
  /** The packages to document, out of the ones the workspace publishes. */
  packages?: (all: WorkspacePackage[]) => WorkspacePackage[];
  /** The sections rendered before the one that lists every package. */
  sections: (packages: WorkspacePackage[]) => Section[];
}

/** The reference this repository generates for itself. */
export const LYNX_STACK: Site = {
  docs: DOCS,
  root: ROOT,
  repository: 'https://github.com/lynx-family/lynx-stack',
  branch: 'main',
  packagePage: name => `https://www.npmjs.com/package/${name}`,
  ownSections: {
    '@lynx-js/react': 'react',
    '@lynx-js/genui': 'genui',
  },
  groups: [
    { name: 'Build tools', dirs: ['packages/rspeedy/', 'packages/webpack/'] },
    { name: 'Web platform', dirs: ['packages/web-platform/'] },
    { name: 'Libraries and tools', dirs: [''] },
  ],
  sections: lynxStackSections,
};

/** Where the pages of a site are written. */
export function contentDir(site: Site): string {
  return join(site.docs, 'content');
}
