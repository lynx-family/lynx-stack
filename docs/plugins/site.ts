// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { join } from 'node:path';

import type { ConfigReference } from './config.ts';
import { lynxStackSections } from './sections.ts';
import type { Section } from './sections.ts';
import { DOCS, ROOT } from './workspace.ts';
import type { Locale, WorkspacePackage } from './workspace.ts';

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
  /** The top navigation, by the section each entry opens. */
  nav: { text: Record<Locale, string>; route: string; active?: string }[];
  /** The sidebar of `/api`, one entry per section, in order. */
  sidebar: { name: string; label: string }[];
  /** The groups the packages are listed under, by directory prefix. */
  groups: { name: string; dirs: string[] }[];
  /** The packages the configuration reference is read from, when there is one. */
  configReference?: ConfigReference;
  /**
   * The package that re-exports another one, by the name of the one it
   * wraps. The reference names and links the wrapper instead.
   */
  wrappers?: Record<string, string>;
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
  configReference: {
    plugin: '@lynx-js/rsbuild-plugin',
    config: '@lynx-js/rspeedy',
    source: 'packages/rspeedy/core/src/config/index.ts',
  },
  nav: [
    { text: { en: 'Frameworks', zh: '框架' }, route: 'api/react' },
    {
      text: { en: 'Build', zh: '构建' },
      route: 'api/config',
      active: 'api/(config|packages)',
    },
  ],
  sidebar: [
    { name: 'react', label: '@lynx-js/react' },
    {
      name: 'react/testing-library',
      label: '@lynx-js/react/testing-library',
    },
    { name: 'genui', label: '@lynx-js/genui' },
    { name: 'config', label: 'Build configuration' },
    { name: 'packages', label: 'All packages' },
  ],
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
