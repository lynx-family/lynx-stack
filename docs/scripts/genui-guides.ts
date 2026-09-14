// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import path from 'node:path';

export function syncGenUIGuides(options: {
  repositoryRoot: string;
  contentRoot: string;
}): void {
  const genuiPackageRoot = path.join(
    options.repositoryRoot,
    'packages/genui',
  );
  const a2uiPackageRoot = path.join(
    options.repositoryRoot,
    'packages/genui/a2ui',
  );
  const a2uiCatalogExtractorPackageRoot = path.join(
    options.repositoryRoot,
    'packages/genui/a2ui-catalog-extractor',
  );
  const openuiPackageRoot = path.join(
    options.repositoryRoot,
    'packages/genui/openui',
  );
  const enGuideRoot = path.join(options.contentRoot, 'en/guide/genui');
  const zhGuideRoot = path.join(options.contentRoot, 'zh/guide/genui');

  syncDoc({
    outFile: path.join(enGuideRoot, 'index.md'),
    sourceFile: path.join(genuiPackageRoot, 'docs/overview.md'),
  });
  syncDoc({
    outFile: path.join(zhGuideRoot, 'index.md'),
    sourceFile: path.join(genuiPackageRoot, 'docs/overview_zh.md'),
  });

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
  syncReadme({
    languageSwitch:
      'English | <a href="/zh/guide/genui/a2ui/catalog-extractor">简体中文</a>',
    outFile: path.join(enGuideRoot, 'a2ui/catalog-extractor.md'),
    sourceFile: path.join(a2uiCatalogExtractorPackageRoot, 'README.md'),
    switchPattern: /^English \| \[简体中文\]\(\.\/readme\.zh_cn\.md\)$/m,
  });
  syncReadme({
    languageSwitch:
      '<a href="/guide/genui/a2ui/catalog-extractor">English</a> | 简体中文',
    outFile: path.join(zhGuideRoot, 'a2ui/catalog-extractor.md'),
    sourceFile: path.join(
      a2uiCatalogExtractorPackageRoot,
      'readme.zh_cn.md',
    ),
    switchPattern: /^\[English\]\(\.\/README\.md\) \| 简体中文$/m,
  });

  removeGeneratedDoc(path.join(enGuideRoot, 'openui'));
  removeGeneratedDoc(path.join(zhGuideRoot, 'openui'));

  syncReadme({
    languageSwitch: 'English | <a href="/zh/guide/genui/openui">简体中文</a>',
    outFile: path.join(enGuideRoot, 'openui.md'),
    replacements: OPENUI_EN_LINK_REPLACEMENTS,
    sourceFile: path.join(openuiPackageRoot, 'README.md'),
    switchPattern: /^English \| \[简体中文\]\(\.\/README_zh\.md\)$/m,
  });

  syncReadme({
    languageSwitch: '<a href="/guide/genui/openui">English</a> | 简体中文',
    outFile: path.join(zhGuideRoot, 'openui.md'),
    replacements: OPENUI_ZH_LINK_REPLACEMENTS,
    sourceFile: path.join(openuiPackageRoot, 'README_zh.md'),
    switchPattern: /^\[English\]\(\.\/README\.md\) \| 简体中文$/m,
  });

  syncDoc({
    outFile: path.join(enGuideRoot, 'openui/overview.md'),
    replacements: OPENUI_EN_LINK_REPLACEMENTS,
    sourceFile: path.join(openuiPackageRoot, 'docs/overview.md'),
  });
  syncDoc({
    outFile: path.join(zhGuideRoot, 'openui/overview.md'),
    replacements: OPENUI_ZH_LINK_REPLACEMENTS,
    sourceFile: path.join(openuiPackageRoot, 'docs/overview_zh.md'),
  });
  syncDoc({
    outFile: path.join(enGuideRoot, 'openui/library-guide.md'),
    replacements: OPENUI_EN_LINK_REPLACEMENTS,
    sourceFile: path.join(openuiPackageRoot, 'docs/library-guide.md'),
  });
  syncDoc({
    outFile: path.join(zhGuideRoot, 'openui/library-guide.md'),
    replacements: OPENUI_ZH_LINK_REPLACEMENTS,
    sourceFile: path.join(openuiPackageRoot, 'docs/library-guide_zh.md'),
  });
  syncDoc({
    outFile: path.join(enGuideRoot, 'openui/system-prompts.md'),
    replacements: OPENUI_EN_LINK_REPLACEMENTS,
    sourceFile: path.join(openuiPackageRoot, 'docs/system-prompts.md'),
  });
  syncDoc({
    outFile: path.join(zhGuideRoot, 'openui/system-prompts.md'),
    replacements: OPENUI_ZH_LINK_REPLACEMENTS,
    sourceFile: path.join(openuiPackageRoot, 'docs/system-prompts_zh.md'),
  });

  removeGeneratedDoc(
    path.join(
      options.contentRoot,
      'en/guide/genui/a2ui-catalog-extractor.md',
    ),
  );
  removeGeneratedDoc(
    path.join(
      options.contentRoot,
      'zh/guide/genui/a2ui-catalog-extractor.md',
    ),
  );

  writeGenUIMeta(options.contentRoot);
}

const GENUI_META = {
  en: {
    overview: 'Overview',
    a2ui: 'A2UI',
    openui: 'OpenUI',
    a2uiDocs: 'A2UI guides',
    openuiDocs: 'OpenUI guides',
  },
  zh: {
    overview: '概览',
    a2ui: 'A2UI',
    openui: 'OpenUI',
    a2uiDocs: 'A2UI 文档',
    openuiDocs: 'OpenUI 文档',
  },
} as const;

const A2UI_PAGES = {
  en: [
    ['overview', 'Overview & Architecture'],
    ['catalog-guide', 'Catalogs & Components'],
    ['system-prompts', 'System Prompts'],
    ['catalog-extractor', 'Catalog Extractor'],
  ],
  zh: [['overview', '概览与架构'], ['catalog-guide', 'Catalogs 与组件'], [
    'system-prompts',
    'System Prompts',
  ], ['catalog-extractor', 'Catalog Extractor']],
} as const;

const OPENUI_PAGES = {
  en: [['overview', 'Overview & Architecture'], [
    'library-guide',
    'Libraries & Components',
  ], ['system-prompts', 'System Prompts']],
  zh: [['overview', '概览与架构'], ['library-guide', 'Libraries 与组件'], [
    'system-prompts',
    'System Prompts',
  ]],
} as const;

function writeGenUIMeta(contentRoot: string): void {
  for (const locale of ['en', 'zh'] as const) {
    const root = path.join(contentRoot, locale, 'guide/genui');
    const t = GENUI_META[locale];
    writeJson(path.join(root, '_meta.json'), [
      { type: 'file', name: 'index', label: t.overview },
      { type: 'file', name: 'a2ui', label: t.a2ui },
      {
        type: 'dir',
        name: 'a2ui',
        label: t.a2uiDocs,
        collapsible: true,
        collapsed: true,
      },
      { type: 'file', name: 'openui', label: t.openui },
      {
        type: 'dir',
        name: 'openui',
        label: t.openuiDocs,
        collapsible: true,
        collapsed: true,
      },
      {
        type: 'custom-link',
        label: 'Playground',
        link: locale === 'zh' ? '/zh/genui' : '/genui',
      },
    ]);
    writeJson(
      path.join(root, 'a2ui/_meta.json'),
      A2UI_PAGES[locale].map(([name, label]) => ({
        type: 'file',
        name,
        label,
      })),
    );
    writeJson(
      path.join(root, 'openui/_meta.json'),
      OPENUI_PAGES[locale].map(([name, label]) => ({
        type: 'file',
        name,
        label,
      })),
    );
  }
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

const A2UI_EN_LINK_REPLACEMENTS = [
  ['./docs/overview.md', '/guide/genui/a2ui/overview'],
  ['./docs/catalog-guide.md', '/guide/genui/a2ui/catalog-guide'],
  ['./docs/system-prompts.md', '/guide/genui/a2ui/system-prompts'],
  ['./overview.md', '/guide/genui/a2ui/overview'],
  ['./catalog-guide.md', '/guide/genui/a2ui/catalog-guide'],
  ['./system-prompts.md', '/guide/genui/a2ui/system-prompts'],
  [
    '../../a2ui-catalog-extractor/README.md',
    '/guide/genui/a2ui/catalog-extractor',
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
    '/zh/guide/genui/a2ui/catalog-extractor',
  ],
  ['../README_zh.md', '/zh/guide/genui/a2ui'],
] as const;

const OPENUI_EN_LINK_REPLACEMENTS = [
  ['./docs/overview.md', '/guide/genui/openui/overview'],
  ['./docs/library-guide.md', '/guide/genui/openui/library-guide'],
  ['./docs/system-prompts.md', '/guide/genui/openui/system-prompts'],
  ['./overview.md', '/guide/genui/openui/overview'],
  ['./library-guide.md', '/guide/genui/openui/library-guide'],
  ['./system-prompts.md', '/guide/genui/openui/system-prompts'],
  ['../README.md', '/guide/genui/openui'],
] as const;

const OPENUI_ZH_LINK_REPLACEMENTS = [
  ['./docs/overview_zh.md', '/zh/guide/genui/openui/overview'],
  ['./docs/library-guide_zh.md', '/zh/guide/genui/openui/library-guide'],
  ['./docs/system-prompts_zh.md', '/zh/guide/genui/openui/system-prompts'],
  ['./overview_zh.md', '/zh/guide/genui/openui/overview'],
  ['./library-guide_zh.md', '/zh/guide/genui/openui/library-guide'],
  ['./system-prompts_zh.md', '/zh/guide/genui/openui/system-prompts'],
  ['../README_zh.md', '/zh/guide/genui/openui'],
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
