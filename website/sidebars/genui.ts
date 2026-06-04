// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import path from 'node:path';

import type { SidebarGroup } from '@rspress/core';

export function createGenUIGuideReadmeDocs(options: {
  repositoryRoot: string;
  websiteRoot: string;
}): {
  en: SidebarGroup;
  zh: SidebarGroup;
} {
  const a2uiPackageRoot = path.join(
    options.repositoryRoot,
    'packages/genui/a2ui',
  );
  const enGuideRoot = path.join(
    options.websiteRoot,
    'docs/en/guide/genui',
  );
  const zhGuideRoot = path.join(
    options.websiteRoot,
    'docs/zh/guide/genui',
  );

  removeGeneratedDoc(path.join(enGuideRoot, 'a2ui'));
  removeGeneratedDoc(path.join(zhGuideRoot, 'a2ui'));

  syncReadme({
    languageSwitch: 'English | <a href="/zh/guide/genui/a2ui">简体中文</a>',
    outFile: path.join(enGuideRoot, 'a2ui.md'),
    replacements: A2UI_EN_LINK_REPLACEMENTS,
    sourceFile: path.join(a2uiPackageRoot, 'README.md'),
    switchPattern: /^English \| \[简体中文\]\(\.\/README_zh\.md\)$/m,
  });

  syncReadme({
    languageSwitch: '<a href="/guide/genui/a2ui">English</a> | 简体中文',
    outFile: path.join(zhGuideRoot, 'a2ui.md'),
    replacements: A2UI_ZH_LINK_REPLACEMENTS,
    sourceFile: path.join(a2uiPackageRoot, 'README_zh.md'),
    switchPattern: /^\[English\]\(\.\/README\.md\) \| 简体中文$/m,
  });

  syncDoc({
    outFile: path.join(enGuideRoot, 'a2ui/overview.md'),
    replacements: A2UI_EN_LINK_REPLACEMENTS,
    sourceFile: path.join(a2uiPackageRoot, 'docs/overview.md'),
  });
  syncDoc({
    outFile: path.join(zhGuideRoot, 'a2ui/overview.md'),
    replacements: A2UI_ZH_LINK_REPLACEMENTS,
    sourceFile: path.join(a2uiPackageRoot, 'docs/overview_zh.md'),
  });
  syncDoc({
    outFile: path.join(enGuideRoot, 'a2ui/catalog-guide.md'),
    replacements: A2UI_EN_LINK_REPLACEMENTS,
    sourceFile: path.join(a2uiPackageRoot, 'docs/catalog-guide.md'),
  });
  syncDoc({
    outFile: path.join(zhGuideRoot, 'a2ui/catalog-guide.md'),
    replacements: A2UI_ZH_LINK_REPLACEMENTS,
    sourceFile: path.join(a2uiPackageRoot, 'docs/catalog-guide_zh.md'),
  });
  syncDoc({
    outFile: path.join(enGuideRoot, 'a2ui/system-prompts.md'),
    replacements: A2UI_EN_LINK_REPLACEMENTS,
    sourceFile: path.join(a2uiPackageRoot, 'docs/system-prompts.md'),
  });
  syncDoc({
    outFile: path.join(zhGuideRoot, 'a2ui/system-prompts.md'),
    replacements: A2UI_ZH_LINK_REPLACEMENTS,
    sourceFile: path.join(a2uiPackageRoot, 'docs/system-prompts_zh.md'),
  });

  removeGeneratedDoc(
    path.join(
      options.websiteRoot,
      'docs/en/guide/genui/a2ui-catalog-extractor.md',
    ),
  );
  removeGeneratedDoc(
    path.join(
      options.websiteRoot,
      'docs/zh/guide/genui/a2ui-catalog-extractor.md',
    ),
  );

  return {
    en: {
      text: 'GenUI',
      items: [
        {
          text: 'A2UI',
          items: A2UI_EN_SIDEBAR_ITEMS,
        },
      ],
    },
    zh: {
      text: 'GenUI',
      items: [
        {
          text: 'A2UI',
          items: A2UI_ZH_SIDEBAR_ITEMS,
        },
      ],
    },
  };
}

export const A2UI_EN_NAV_ITEMS = [
  {
    text: 'Introduction README',
    link: '/guide/genui/a2ui',
  },
  {
    text: 'Overview & Architecture',
    link: '/guide/genui/a2ui/overview',
  },
  {
    text: 'Catalogs & Components',
    link: '/guide/genui/a2ui/catalog-guide',
  },
  {
    text: 'System Prompts',
    link: '/guide/genui/a2ui/system-prompts',
  },
  {
    text: 'Playground',
    link: '/a2ui',
  },
];

export const A2UI_ZH_NAV_ITEMS = [
  {
    text: '简介 README',
    link: '/zh/guide/genui/a2ui',
  },
  {
    text: '概览与架构',
    link: '/zh/guide/genui/a2ui/overview',
  },
  {
    text: 'Catalogs 与组件',
    link: '/zh/guide/genui/a2ui/catalog-guide',
  },
  {
    text: 'System Prompts',
    link: '/zh/guide/genui/a2ui/system-prompts',
  },
  {
    text: 'Playground',
    link: '/a2ui',
  },
];

const A2UI_EN_SIDEBAR_ITEMS = A2UI_EN_NAV_ITEMS.map(item => ({
  ...item,
  text: item.text.replace(' README', ''),
}));

const A2UI_ZH_SIDEBAR_ITEMS = A2UI_ZH_NAV_ITEMS.map(item => ({
  ...item,
  text: item.text.replace(' README', ''),
}));

const A2UI_EN_LINK_REPLACEMENTS = [
  ['./docs/overview.md', '/guide/genui/a2ui/overview'],
  ['./docs/catalog-guide.md', '/guide/genui/a2ui/catalog-guide'],
  ['./docs/system-prompts.md', '/guide/genui/a2ui/system-prompts'],
  ['./overview.md', '/guide/genui/a2ui/overview'],
  ['./catalog-guide.md', '/guide/genui/a2ui/catalog-guide'],
  ['./system-prompts.md', '/guide/genui/a2ui/system-prompts'],
  [
    '../../a2ui-catalog-extractor/README.md',
    'https://github.com/lynx-family/lynx-stack/tree/main/packages/genui/a2ui-catalog-extractor#readme',
  ],
  ['../README.md', '/guide/genui/a2ui'],
] as const;

const A2UI_ZH_LINK_REPLACEMENTS = [
  ['./docs/overview_zh.md', '/zh/guide/genui/a2ui/overview'],
  ['./docs/catalog-guide_zh.md', '/zh/guide/genui/a2ui/catalog-guide'],
  ['./docs/system-prompts_zh.md', '/zh/guide/genui/a2ui/system-prompts'],
  ['./overview_zh.md', '/zh/guide/genui/a2ui/overview'],
  ['./catalog-guide_zh.md', '/zh/guide/genui/a2ui/catalog-guide'],
  ['./system-prompts_zh.md', '/zh/guide/genui/a2ui/system-prompts'],
  [
    '../../a2ui-catalog-extractor/readme.zh_cn.md',
    'https://github.com/lynx-family/lynx-stack/blob/main/packages/genui/a2ui-catalog-extractor/readme.zh_cn.md',
  ],
  ['../README_zh.md', '/zh/guide/genui/a2ui'],
] as const;

function syncReadme(options: {
  languageSwitch: string;
  outFile: string;
  replacements?: readonly (readonly [string, string])[];
  sourceFile: string;
  switchPattern: RegExp;
}): void {
  const content = applyLinkReplacements(
    fs.readFileSync(options.sourceFile, 'utf8'),
    options.replacements ?? [],
  );
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

function syncDoc(options: {
  outFile: string;
  replacements?: readonly (readonly [string, string])[];
  sourceFile: string;
}): void {
  const content = applyLinkReplacements(
    fs.readFileSync(options.sourceFile, 'utf8'),
    options.replacements ?? [],
  );

  fs.mkdirSync(path.dirname(options.outFile), { recursive: true });
  fs.writeFileSync(options.outFile, content);
}

function applyLinkReplacements(
  content: string,
  replacements: readonly (readonly [string, string])[],
): string {
  return replacements.reduce(
    (current, [from, to]) => current.split(from).join(to),
    content,
  );
}

function removeGeneratedDoc(outFile: string): void {
  if (fs.existsSync(outFile)) {
    fs.rmSync(outFile, { recursive: true, force: true });
  }
}
