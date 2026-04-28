// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import path from 'node:path';

import type {
  SidebarDivider,
  SidebarItem,
  SidebarSectionHeader,
} from '@rspress/core';

type GenUISidebar = (SidebarItem | SidebarSectionHeader | SidebarDivider)[];

export function createGenUIReadmeDocs(options: {
  repositoryRoot: string;
  websiteRoot: string;
}): {
  en: GenUISidebar;
  zh: GenUISidebar;
} {
  const packageRoot = path.join(
    options.repositoryRoot,
    'packages/genui/a2ui-catalog-extractor',
  );

  syncReadme({
    languageSwitch:
      'English | <a href="/zh/genui/a2ui-catalog-extractor">简体中文</a>',
    outFile: path.join(
      options.websiteRoot,
      'docs/en/genui/a2ui-catalog-extractor.md',
    ),
    sourceFile: path.join(packageRoot, 'README.md'),
    switchPattern: /^English \| \[简体中文\]\(\.\/readme\.zh_cn\.md\)$/m,
  });

  syncReadme({
    languageSwitch:
      '<a href="/genui/a2ui-catalog-extractor">English</a> | 简体中文',
    outFile: path.join(
      options.websiteRoot,
      'docs/zh/genui/a2ui-catalog-extractor.md',
    ),
    sourceFile: path.join(packageRoot, 'readme.zh_cn.md'),
    switchPattern: /^\[English\]\(\.\/README\.md\) \| 简体中文$/m,
  });

  return {
    en: [
      {
        sectionHeaderText: 'GenUI',
      },
      {
        dividerType: 'solid',
      },
      {
        text: 'A2UI Catalog Extractor',
        link: '/genui/a2ui-catalog-extractor',
      },
    ],
    zh: [
      {
        sectionHeaderText: 'GenUI',
      },
      {
        dividerType: 'solid',
      },
      {
        text: 'A2UI Catalog Extractor',
        link: '/zh/genui/a2ui-catalog-extractor',
      },
    ],
  };
}

function syncReadme(options: {
  languageSwitch: string;
  outFile: string;
  sourceFile: string;
  switchPattern: RegExp;
}): void {
  const content = fs.readFileSync(options.sourceFile, 'utf8');
  const nextContent = content.replace(
    options.switchPattern,
    options.languageSwitch,
  );

  if (nextContent === content) {
    throw new Error(
      `Failed to rewrite language switch in ${options.sourceFile}.`,
    );
  }

  fs.mkdirSync(path.dirname(options.outFile), { recursive: true });
  fs.writeFileSync(options.outFile, nextContent);
}
