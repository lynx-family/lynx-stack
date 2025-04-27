// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  NavItemWithLink,
  SidebarDivider,
  SidebarItem,
  SidebarSectionHeader,
} from '@rspress/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(__dirname);
const require = createRequire(import.meta.url);

export function createChangelogs(
  name: string,
  packageNames: string[],
  locale: 'zh' | 'en' = 'en',
): {
  navbar: NavItemWithLink[];
  sidebar: (SidebarItem | SidebarSectionHeader | SidebarDivider)[];
} {
  const navbar: NavItemWithLink[] = [];
  const sidebar: (SidebarItem | SidebarSectionHeader | SidebarDivider)[] = [
    {
      sectionHeaderText: name,
    },
    {
      dividerType: 'solid',
    },
  ];

  const dist = path.resolve(ROOT, 'docs', locale, 'changelog');
  fs.mkdirSync(dist, { recursive: true });

  for (const packageName of packageNames) {
    const normalizedName = createChangelog(
      packageName,
      dist,
    );
    if (normalizedName === null) {
      continue;
    }

    sidebar.push({
      text: packageName,
      link: `/${
        locale === 'zh' ? `${locale}/` : ''
      }changelog/${normalizedName}`,
    });
    navbar.push({
      text: packageName,
      link: `/${
        locale === 'zh' ? `${locale}/` : ''
      }changelog/${normalizedName}`,
    });
  }

  return { navbar, sidebar };
}

function createChangelog(packageName: string, dist: string) {
  const CHANGELOG = path.join(
    path.dirname(require.resolve(`${packageName}/package.json`)),
    'CHANGELOG.md',
  );

  if (!fs.existsSync(CHANGELOG)) {
    return null;
  }

  const normalizedName = normalizePackageName(packageName);

  fs.copyFileSync(
    CHANGELOG,
    path.format({
      dir: dist,
      name: normalizedName,
      ext: '.md',
    }),
  );

  return normalizedName;
}

function normalizePackageName(packageName: string) {
  return packageName
    .replace(/^@/, '')
    .replace(/\//g, '--');
}
