// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { rspack } from '@rspack/core';
import { afterAll, describe, expect, it } from '@rstest/core';

import {
  ReactWebpackPlugin,
  collectElementTemplatesForEntries,
  collectElementTemplatesFromModule,
  mergeElementTemplate,
  mergeElementTemplatesFromModule,
} from '../src/ReactWebpackPlugin.js';
import type { ModuleWithElementTemplateBuildInfo } from '../src/ReactWebpackPlugin.js';

const require = createRequire(import.meta.url);
const reactPackagePath = require.resolve('@lynx-js/react/package.json');
const reactRuntimePath = path.dirname(reactPackagePath);
const workletRuntimePath = require.resolve(
  '@lynx-js/react/worklet-runtime',
);
const snapshotEntry = path.join(
  reactRuntimePath,
  'runtime/lib/lynx.js',
);
const elementTemplateEntry = path.join(
  reactRuntimePath,
  'runtime/lib/element-template/native/index.js',
);
const profileOutputRoots: string[] = [];
const profileMarkers = [
  'FLOW_ID',
  'PATCH_LENGTH',
  'ReactLynx::diffFinishNoPatch',
  'ReactLynx::hooks::',
  'ReactLynx::render::',
];

interface ProfileCompileOptions {
  backend?: 'element-template' | 'snapshot';
  compilerName: string;
  entry?: string;
  mode?: 'development' | 'production';
  profile: boolean | undefined;
  resolvedRuntime: boolean;
}

async function compileProfileArtifact({
  backend = 'snapshot',
  compilerName,
  entry = backend === 'snapshot' ? snapshotEntry : elementTemplateEntry,
  mode = 'production',
  profile,
  resolvedRuntime,
}: ProfileCompileOptions): Promise<string> {
  const outputPath = await fs.mkdtemp(
    path.join(os.tmpdir(), 'react-profile-reachability-'),
  );
  profileOutputRoots.push(outputPath);

  const compiler = rspack({
    name: compilerName,
    mode,
    context: reactRuntimePath,
    entry,
    output: {
      path: outputPath,
      filename: 'bundle.js',
    },
    plugins: [
      new ReactWebpackPlugin({
        profile,
        workletRuntimePath: resolvedRuntime ? workletRuntimePath : '',
        experimental_useElementTemplate: backend === 'element-template',
      }),
    ],
  });

  await new Promise<void>((resolve, reject) => {
    compiler.run((error, stats) => {
      if (error || stats?.hasErrors()) {
        reject(
          error
            ?? new Error(stats?.toString({ all: false, errors: true })),
        );
        return;
      }
      resolve();
    });
  });

  return await fs.readFile(path.join(outputPath, 'bundle.js'), 'utf8');
}

afterAll(async () => {
  await Promise.all(
    profileOutputRoots.map(outputPath =>
      fs.rm(outputPath, { recursive: true, force: true })
    ),
  );
});

describe('profile component-hook reachability', () => {
  it.each(
    [
      ['Snapshot', 'snapshot'],
      ['Element Template', 'element-template'],
    ] as const,
  )('excludes exhaustive hooks from scoped default Web %s builds', async (
    _caseName,
    backend,
  ) => {
    const code = await compileProfileArtifact({
      backend,
      compilerName: 'web',
      profile: false,
      resolvedRuntime: true,
    });

    for (const marker of profileMarkers) {
      expect(code).not.toContain(marker);
    }
  });

  it.each(
    [
      ['Snapshot explicit Web profiling', 'snapshot', 'web', true, true],
      [
        'Snapshot native host recording support',
        'snapshot',
        'lynx',
        false,
        true,
      ],
      ['Snapshot unresolved direct webpack', 'snapshot', 'web', false, false],
      [
        'Element Template explicit Web profiling',
        'element-template',
        'web',
        true,
        true,
      ],
      [
        'Element Template native host recording support',
        'element-template',
        'lynx',
        false,
        true,
      ],
    ] as const,
  )('retains exhaustive hooks for %s', async (
    _caseName,
    backend,
    compilerName,
    profile,
    resolvedRuntime,
  ) => {
    const code = await compileProfileArtifact({
      backend,
      compilerName,
      profile,
      resolvedRuntime,
    });

    const expectedMarkers = backend === 'snapshot'
      ? profileMarkers
      : profileMarkers.filter(marker => marker !== 'ReactLynx::hooks::');
    for (const marker of expectedMarkers) {
      expect(code).toContain(marker);
    }
  });

  it('retains exhaustive hooks in development Web builds', async () => {
    const code = await compileProfileArtifact({
      compilerName: 'web',
      mode: 'development',
      profile: undefined,
      resolvedRuntime: true,
    });

    for (const marker of profileMarkers) {
      expect(code).toContain(marker);
    }
  });

  it('treats REACT_PROFILE=false as an explicit disable', async () => {
    const previous = process.env['REACT_PROFILE'];
    process.env['REACT_PROFILE'] = 'false';
    try {
      const code = await compileProfileArtifact({
        compilerName: 'web',
        profile: true,
        resolvedRuntime: true,
      });

      for (const marker of profileMarkers) {
        expect(code).not.toContain(marker);
      }
    } finally {
      if (previous === undefined) {
        delete process.env['REACT_PROFILE'];
      } else {
        process.env['REACT_PROFILE'] = previous;
      }
    }
  });

  it('does not replace lookalike user modules outside React runtime', async () => {
    const fixtureRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'react-profile-lookalike-'),
    );
    profileOutputRoots.push(fixtureRoot);
    const moduleDirectory = path.join(
      fixtureRoot,
      'snapshot/debug',
    );
    await fs.mkdir(moduleDirectory, { recursive: true });
    await fs.writeFile(
      path.join(moduleDirectory, 'profileHooks.js'),
      'export const userProfileHookMarker = "USER_PROFILE_HOOK";\n',
    );
    const entry = path.join(fixtureRoot, 'index.js');
    await fs.writeFile(
      entry,
      'import { userProfileHookMarker } from "./snapshot/debug/profileHooks.js";\n'
        + 'globalThis.userProfileHookMarker = userProfileHookMarker;\n',
    );

    const code = await compileProfileArtifact({
      compilerName: 'web',
      entry,
      profile: false,
      resolvedRuntime: true,
    });

    expect(code).toContain('USER_PROFILE_HOOK');
  });
});

describe('collectElementTemplatesFromModule', () => {
  it('collects templates from nested modules', () => {
    const module = {
      buildInfo: {
        'lynx:element-templates': [
          {
            templateId: 'root-template',
            compiledTemplate: { type: 'view' },
          },
        ],
      },
      modules: [
        {
          buildInfo: {
            'lynx:element-templates': [
              {
                templateId: 'nested-template',
                compiledTemplate: { type: 'text' },
              },
            ],
          },
          modules: [
            {
              buildInfo: {
                'lynx:element-templates': [
                  {
                    templateId: 'deep-template',
                    compiledTemplate: { type: 'image' },
                  },
                ],
              },
            },
          ],
        },
      ],
    } satisfies ModuleWithElementTemplateBuildInfo;

    expect(collectElementTemplatesFromModule(module)).toEqual([
      {
        templateId: 'root-template',
        compiledTemplate: { type: 'view' },
      },
      {
        templateId: 'nested-template',
        compiledTemplate: { type: 'text' },
      },
      {
        templateId: 'deep-template',
        compiledTemplate: { type: 'image' },
      },
    ]);
  });
});

describe('mergeElementTemplate', () => {
  it('keeps one entry for duplicate same-id same-content templates', () => {
    const elementTemplates: Record<string, Record<string, unknown>> = {};
    const compiledTemplate = {
      kind: 'element',
      type: 'view',
      attributesArray: [
        {
          kind: 'static',
          key: 'class',
          value: 'card',
        },
      ],
      children: [],
    };

    mergeElementTemplate(elementTemplates, '_et_same', compiledTemplate);
    mergeElementTemplate(elementTemplates, '_et_same', {
      children: [],
      attributesArray: [
        {
          value: 'card',
          key: 'class',
          kind: 'static',
        },
      ],
      type: 'view',
      kind: 'element',
    });

    expect(elementTemplates).toEqual({
      _et_same: compiledTemplate,
    });
  });

  it('throws when duplicate same-id templates have different content', () => {
    const elementTemplates: Record<string, Record<string, unknown>> = {};

    mergeElementTemplate(elementTemplates, '_et_collision', {
      kind: 'element',
      type: 'view',
      attributesArray: [],
      children: [],
    });

    expect(() =>
      mergeElementTemplate(elementTemplates, '_et_collision', {
        kind: 'element',
        type: 'text',
        attributesArray: [],
        children: [],
      })
    ).toThrowError(
      'Element Template id collision for _et_collision: same template id has different compiledTemplate content.',
    );
  });
});

describe('mergeElementTemplatesFromModule', () => {
  it('merges duplicate same-id same-content templates collected from nested module buildInfo', () => {
    const elementTemplates: Record<string, Record<string, unknown>> = {};
    const compiledTemplate = {
      kind: 'element',
      type: 'view',
      attributesArray: [],
      children: [],
    };
    const module = {
      buildInfo: {
        'lynx:element-templates': [
          {
            templateId: '_et_same',
            compiledTemplate,
          },
        ],
      },
      modules: [
        {
          buildInfo: {
            'lynx:element-templates': [
              {
                templateId: '_et_same',
                compiledTemplate: {
                  children: [],
                  attributesArray: [],
                  type: 'view',
                  kind: 'element',
                },
              },
            ],
          },
        },
      ],
    } satisfies ModuleWithElementTemplateBuildInfo;

    mergeElementTemplatesFromModule(elementTemplates, module);

    expect(elementTemplates).toEqual({
      _et_same: compiledTemplate,
    });
  });

  it('throws when collected nested module buildInfo has same-id different-content templates', () => {
    const elementTemplates: Record<string, Record<string, unknown>> = {};
    const module = {
      buildInfo: {
        'lynx:element-templates': [
          {
            templateId: '_et_collision',
            compiledTemplate: {
              kind: 'element',
              type: 'view',
              attributesArray: [],
              children: [],
            },
          },
        ],
      },
      modules: [
        {
          buildInfo: {
            'lynx:element-templates': [
              {
                templateId: '_et_collision',
                compiledTemplate: {
                  kind: 'element',
                  type: 'text',
                  attributesArray: [],
                  children: [],
                },
              },
            ],
          },
        },
      ],
    } satisfies ModuleWithElementTemplateBuildInfo;

    expect(() => mergeElementTemplatesFromModule(elementTemplates, module))
      .toThrowError(
        'Element Template id collision for _et_collision: same template id has different compiledTemplate content.',
      );
  });
});

function moduleWithTemplate(
  templateId: string,
  compiledTemplate: Record<string, unknown>,
): ModuleWithElementTemplateBuildInfo {
  return {
    buildInfo: {
      'lynx:element-templates': [{ templateId, compiledTemplate }],
    },
  };
}

describe('collectElementTemplatesForEntries', () => {
  it('scopes templates to the encoded bundle so a lazy template does not leak into the main bundle', () => {
    const mainModule = moduleWithTemplate('_et_main', { type: 'view' });
    const lazyModule = moduleWithTemplate('_et_lazy', { type: 'text' });

    // The main entrypoint's chunk group only contains its initial chunk; the
    // dynamic component lives in a separate (async / standalone) chunk group.
    const mainChunk = { id: 'main' };
    const lazyChunk = { id: 'LazyComponent' };
    const groups: Record<string, { chunks: typeof mainChunk[] }> = {
      main: { chunks: [mainChunk] },
      'LazyComponent.lynx.bundle': { chunks: [lazyChunk] },
    };
    const chunkModules = new Map([
      [mainChunk, [mainModule]],
      [lazyChunk, [lazyModule]],
    ]);
    const getChunkGroup = (name: string) => groups[name];
    const getChunkModules = (chunk: typeof mainChunk) =>
      chunkModules.get(chunk) ?? [];

    expect(
      collectElementTemplatesForEntries(
        ['main'],
        getChunkGroup,
        getChunkModules,
      ),
    ).toEqual({ _et_main: { type: 'view' } });

    expect(
      collectElementTemplatesForEntries(
        ['LazyComponent.lynx.bundle'],
        getChunkGroup,
        getChunkModules,
      ),
    ).toEqual({ _et_lazy: { type: 'text' } });
  });

  it('dedupes a module shared across chunks of the same bundle', () => {
    const sharedModule = moduleWithTemplate('_et_shared', { type: 'view' });
    const chunkA = { id: 'a' };
    const chunkB = { id: 'b' };
    const group = { chunks: [chunkA, chunkB] };

    // Same module object in both chunks must be collected (and merged) once.
    expect(
      collectElementTemplatesForEntries(
        ['main'],
        () => group,
        () => [sharedModule],
      ),
    ).toEqual({ _et_shared: { type: 'view' } });
  });

  it('skips unknown entry names', () => {
    expect(
      collectElementTemplatesForEntries(
        ['does-not-exist'],
        () => undefined,
        () => [],
      ),
    ).toEqual({});
  });
});
