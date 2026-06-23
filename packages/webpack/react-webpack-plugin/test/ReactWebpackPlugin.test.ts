// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from '@rstest/core';

import {
  collectElementTemplatesForEntries,
  collectElementTemplatesFromModule,
  mergeElementTemplate,
  mergeElementTemplatesFromModule,
} from '../src/ReactWebpackPlugin.js';
import type { ModuleWithElementTemplateBuildInfo } from '../src/ReactWebpackPlugin.js';

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
