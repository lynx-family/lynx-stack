// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from 'vitest';

import {
  collectElementTemplatesFromModule,
} from '../src/ReactWebpackPlugin.js';
import type { ModuleWithElementTemplateBuildInfo } from '../src/ReactWebpackPlugin.js';

describe('collectElementTemplatesFromModule', () => {
  it('collects templates from nested modules', () => {
    const module = {
      buildInfo: {
        'lynx:element-templates': [
          {
            templateId: 'root-template',
            compiledTemplate: { tag: 'view' },
          },
        ],
      },
      modules: [
        {
          buildInfo: {
            'lynx:element-templates': [
              {
                templateId: 'nested-template',
                compiledTemplate: { tag: 'text' },
              },
            ],
          },
          modules: [
            {
              buildInfo: {
                'lynx:element-templates': [
                  {
                    templateId: 'deep-template',
                    compiledTemplate: { tag: 'image' },
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
        compiledTemplate: { tag: 'view' },
      },
      {
        templateId: 'nested-template',
        compiledTemplate: { tag: 'text' },
      },
      {
        templateId: 'deep-template',
        compiledTemplate: { tag: 'image' },
      },
    ]);
  });
});
