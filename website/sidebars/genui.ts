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
  const lynxXmlPackageRoot = path.join(
    options.repositoryRoot,
    'packages/genui/lynx-xml',
  );
  const enGuideRoot = path.join(
    options.websiteRoot,
    'docs/en/guide/genui',
  );
  const zhGuideRoot = path.join(
    options.websiteRoot,
    'docs/zh/guide/genui',
  );

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

  for (
    const [locale, guideRoot] of [['en', enGuideRoot], [
      'zh',
      zhGuideRoot,
    ]] as const
  ) {
    const suffix = locale === 'zh' ? '_zh' : '';
    const route = `${locale === 'zh' ? '/zh' : ''}/guide/genui/reactlynx`;
    const replacements = ['overview', 'source-guide', 'system-prompts'].flatMap(
      page => [
        [`./docs/${page}${suffix}.md`, `${route}/${page}`] as const,
        [`./${page}${suffix}.md`, `${route}/${page}`] as const,
      ],
    );
    const packageRoot = path.join(genuiPackageRoot, 'reactlynx');
    removeGeneratedDoc(path.join(guideRoot, 'reactlynx'));
    syncReadme({
      languageSwitch: locale === 'zh'
        ? '<a href="/guide/genui/reactlynx">English</a> | 简体中文'
        : 'English | <a href="/zh/guide/genui/reactlynx">简体中文</a>',
      outFile: path.join(guideRoot, 'reactlynx.md'),
      replacements,
      sourceFile: path.join(packageRoot, `README${suffix}.md`),
      switchPattern: locale === 'zh'
        ? /^\[English\]\(\.\/README\.md\) \| 简体中文$/m
        : /^English \| \[简体中文\]\(\.\/README_zh\.md\)$/m,
    });
    for (const page of ['overview', 'source-guide', 'system-prompts']) {
      syncDoc({
        outFile: path.join(guideRoot, `reactlynx/${page}.md`),
        replacements,
        sourceFile: path.join(packageRoot, `docs/${page}${suffix}.md`),
      });
    }
  }

  removeGeneratedDoc(path.join(enGuideRoot, 'lynx-xml'));
  syncReadme({
    languageSwitch: 'English | <a href="/zh/guide/genui/lynx-xml">简体中文</a>',
    outFile: path.join(enGuideRoot, 'lynx-xml.md'),
    replacements: LYNX_XML_EN_LINK_REPLACEMENTS,
    sourceFile: path.join(lynxXmlPackageRoot, 'README.md'),
    switchPattern: /^English \| \[简体中文\]\(\.\/README_zh\.md\)$/m,
  });
  syncDoc({
    outFile: path.join(enGuideRoot, 'lynx-xml/overview.md'),
    replacements: LYNX_XML_EN_LINK_REPLACEMENTS,
    sourceFile: path.join(lynxXmlPackageRoot, 'docs/overview.md'),
  });
  syncDoc({
    outFile: path.join(enGuideRoot, 'lynx-xml/artifact-guide.md'),
    replacements: LYNX_XML_EN_LINK_REPLACEMENTS,
    sourceFile: path.join(lynxXmlPackageRoot, 'docs/artifact-guide.md'),
  });
  syncDoc({
    outFile: path.join(enGuideRoot, 'lynx-xml/system-prompts.md'),
    replacements: LYNX_XML_EN_LINK_REPLACEMENTS,
    sourceFile: path.join(lynxXmlPackageRoot, 'docs/system-prompts.md'),
  });

  removeGeneratedDoc(path.join(zhGuideRoot, 'lynx-xml'));
  syncReadme({
    languageSwitch: '<a href="/guide/genui/lynx-xml">English</a> | 简体中文',
    outFile: path.join(zhGuideRoot, 'lynx-xml.md'),
    replacements: LYNX_XML_ZH_LINK_REPLACEMENTS,
    sourceFile: path.join(lynxXmlPackageRoot, 'README_zh.md'),
    switchPattern: /^\[English\]\(\.\/README\.md\) \| 简体中文$/m,
  });
  syncDoc({
    outFile: path.join(zhGuideRoot, 'lynx-xml/overview.md'),
    replacements: LYNX_XML_ZH_LINK_REPLACEMENTS,
    sourceFile: path.join(lynxXmlPackageRoot, 'docs/overview_zh.md'),
  });
  syncDoc({
    outFile: path.join(zhGuideRoot, 'lynx-xml/artifact-guide.md'),
    replacements: LYNX_XML_ZH_LINK_REPLACEMENTS,
    sourceFile: path.join(lynxXmlPackageRoot, 'docs/artifact-guide_zh.md'),
  });
  syncDoc({
    outFile: path.join(zhGuideRoot, 'lynx-xml/system-prompts.md'),
    replacements: LYNX_XML_ZH_LINK_REPLACEMENTS,
    sourceFile: path.join(lynxXmlPackageRoot, 'docs/system-prompts_zh.md'),
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
          text: 'Overview',
          link: '/guide/genui',
        },
        {
          text: 'A2UI',
          items: A2UI_EN_SIDEBAR_ITEMS,
        },
        {
          text: 'OpenUI',
          items: OPENUI_EN_SIDEBAR_ITEMS,
        },
        {
          text: 'ReactLynx',
          items: REACTLYNX_EN_NAV_ITEMS,
        },
        {
          text: 'Lynx XML',
          items: LYNX_XML_EN_SIDEBAR_ITEMS,
        },
        {
          text: 'Playground',
          link: '/genui',
        },
      ],
    },
    zh: {
      text: 'GenUI',
      items: [
        {
          text: '概览',
          link: '/zh/guide/genui',
        },
        {
          text: 'A2UI',
          items: A2UI_ZH_SIDEBAR_ITEMS,
        },
        {
          text: 'OpenUI',
          items: OPENUI_ZH_SIDEBAR_ITEMS,
        },
        {
          text: 'ReactLynx',
          items: REACTLYNX_ZH_NAV_ITEMS,
        },
        {
          text: 'Lynx XML',
          items: LYNX_XML_ZH_SIDEBAR_ITEMS,
        },
        {
          text: 'Playground',
          link: '/zh/genui',
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
];

export const OPENUI_EN_NAV_ITEMS = [
  {
    text: 'Introduction README',
    link: '/guide/genui/openui',
  },
  {
    text: 'Overview & Architecture',
    link: '/guide/genui/openui/overview',
  },
  {
    text: 'Libraries & Components',
    link: '/guide/genui/openui/library-guide',
  },
  {
    text: 'System Prompts',
    link: '/guide/genui/openui/system-prompts',
  },
];

export const OPENUI_ZH_NAV_ITEMS = [
  {
    text: '简介 README',
    link: '/zh/guide/genui/openui',
  },
  {
    text: '概览与架构',
    link: '/zh/guide/genui/openui/overview',
  },
  {
    text: 'Libraries 与组件',
    link: '/zh/guide/genui/openui/library-guide',
  },
  {
    text: 'System Prompts',
    link: '/zh/guide/genui/openui/system-prompts',
  },
];

export const REACTLYNX_EN_NAV_ITEMS = [
  { text: 'Introduction', link: '/guide/genui/reactlynx' },
  { text: 'Overview & Architecture', link: '/guide/genui/reactlynx/overview' },
  { text: 'Source & Builds', link: '/guide/genui/reactlynx/source-guide' },
  { text: 'System Prompts', link: '/guide/genui/reactlynx/system-prompts' },
];

export const REACTLYNX_ZH_NAV_ITEMS = [
  { text: '简介', link: '/zh/guide/genui/reactlynx' },
  { text: '概览与架构', link: '/zh/guide/genui/reactlynx/overview' },
  { text: '源码与构建', link: '/zh/guide/genui/reactlynx/source-guide' },
  { text: 'System Prompts', link: '/zh/guide/genui/reactlynx/system-prompts' },
];

export const LYNX_XML_EN_NAV_ITEMS = [
  {
    text: 'Introduction README',
    link: '/guide/genui/lynx-xml',
  },
  {
    text: 'Overview & Architecture',
    link: '/guide/genui/lynx-xml/overview',
  },
  {
    text: 'Artifacts & Validation',
    link: '/guide/genui/lynx-xml/artifact-guide',
  },
  {
    text: 'System Prompts',
    link: '/guide/genui/lynx-xml/system-prompts',
  },
];

export const LYNX_XML_ZH_NAV_ITEMS = [
  {
    text: '简介 README',
    link: '/zh/guide/genui/lynx-xml',
  },
  {
    text: '概览与架构',
    link: '/zh/guide/genui/lynx-xml/overview',
  },
  {
    text: '产物与校验',
    link: '/zh/guide/genui/lynx-xml/artifact-guide',
  },
  {
    text: 'System Prompts',
    link: '/zh/guide/genui/lynx-xml/system-prompts',
  },
];

export const GENUI_EN_NAV_ITEMS = [
  {
    text: 'GenUI Overview',
    link: '/guide/genui',
  },
  {
    text: 'A2UI',
    link: '/guide/genui/a2ui',
    items: A2UI_EN_NAV_ITEMS.slice(1),
  },
  {
    text: 'OpenUI',
    link: '/guide/genui/openui',
    items: OPENUI_EN_NAV_ITEMS.slice(1),
  },
  {
    text: 'ReactLynx',
    link: '/guide/genui/reactlynx',
    items: REACTLYNX_EN_NAV_ITEMS.slice(1),
  },
  {
    text: 'Lynx XML',
    link: '/guide/genui/lynx-xml',
    items: LYNX_XML_EN_NAV_ITEMS.slice(1),
  },
  {
    text: 'Playground',
    link: '/genui',
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

const OPENUI_EN_SIDEBAR_ITEMS = OPENUI_EN_NAV_ITEMS.map(item => ({
  ...item,
  text: item.text.replace(' README', ''),
}));

const OPENUI_ZH_SIDEBAR_ITEMS = OPENUI_ZH_NAV_ITEMS.map(item => ({
  ...item,
  text: item.text.replace(' README', ''),
}));

const LYNX_XML_EN_SIDEBAR_ITEMS = LYNX_XML_EN_NAV_ITEMS.map(item => ({
  ...item,
  text: item.text.replace(' README', ''),
}));

const LYNX_XML_EN_LINK_REPLACEMENTS = [
  ['./docs/overview.md', '/guide/genui/lynx-xml/overview'],
  ['./overview.md', '/guide/genui/lynx-xml/overview'],
  ['./docs/artifact-guide.md', '/guide/genui/lynx-xml/artifact-guide'],
  ['./artifact-guide.md', '/guide/genui/lynx-xml/artifact-guide'],
  ['./docs/system-prompts.md', '/guide/genui/lynx-xml/system-prompts'],
  ['./system-prompts.md', '/guide/genui/lynx-xml/system-prompts'],
  ['../README.md', '/guide/genui/lynx-xml'],
] as const;

const LYNX_XML_ZH_SIDEBAR_ITEMS = LYNX_XML_ZH_NAV_ITEMS.map(item => ({
  ...item,
  text: item.text.replace(' README', ''),
}));

const LYNX_XML_ZH_LINK_REPLACEMENTS = [
  ['./docs/overview_zh.md', '/zh/guide/genui/lynx-xml/overview'],
  ['./overview_zh.md', '/zh/guide/genui/lynx-xml/overview'],
  ['./docs/artifact-guide_zh.md', '/zh/guide/genui/lynx-xml/artifact-guide'],
  ['./artifact-guide_zh.md', '/zh/guide/genui/lynx-xml/artifact-guide'],
  ['./docs/system-prompts_zh.md', '/zh/guide/genui/lynx-xml/system-prompts'],
  ['./system-prompts_zh.md', '/zh/guide/genui/lynx-xml/system-prompts'],
  ['../README_zh.md', '/zh/guide/genui/lynx-xml'],
] as const;

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
