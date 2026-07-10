// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { json } from '@codemirror/lang-json';

import type { ComponentCatalogSource } from './ComponentCatalog.js';
import { CATEGORIES, COMPONENT_CATALOG } from '../../catalog/a2ui.js';
import type { ComponentDoc } from '../../catalog/a2ui.js';
import { DEFAULT_A2UI_DEMO_URL } from '../../utils/demoUrl.js';
import { buildRenderUrl } from '../../utils/renderUrl.js';

interface A2UIUsageContext {
  data?: unknown;
  dataPath?: string;
}

const jsonExtensions = [json()];

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function createComponentPreviewMessages(
  component: ComponentDoc,
  usage: unknown,
  context?: A2UIUsageContext,
): unknown[] {
  const components = Array.isArray(usage) ? usage : [usage];
  const messages: unknown[] = [
    {
      createSurface: {
        surfaceId: 'default',
        catalogId: `component-${component.name.toLowerCase()}`,
      },
    },
  ];
  if (context?.data !== undefined) {
    messages.push({
      updateDataModel: {
        surfaceId: 'default',
        path: context.dataPath ?? '/',
        value: context.data,
      },
    });
  }
  messages.push({
    updateComponents: {
      surfaceId: 'default',
      components,
    },
  });
  return messages;
}

export const A2UI_COMPONENT_CATALOG_SOURCE = {
  categories: CATEGORIES,
  components: COMPONENT_CATALOG,
  routeSegment: 'catalog',
  headerTitle: 'Basic Catalog',
  headerDescription:
    'To help developers get started quickly, Lynx team maintains basic components. Based on them, developers can build custom catalog.',
  gridDescription: 'Browse all supported A2UI components by category.',
  usage: {
    editorLabel: 'JSON',
    sideHint: 'JSON editor and live phone preview',
    hint: 'Edit the JSON below to change the component preview instantly.',
    propsHint:
      'Reference the available props before editing the usage JSON below.',
    extensions: jsonExtensions,
    getExamples(component, protocol) {
      const examples = component.usageExamples[protocol.name];
      if (examples.length === 0) {
        return [{
          label: 'Default',
          value: formatJson(component.usage[protocol.name]),
        }];
      }
      return examples.map((example) => ({
        label: example.label,
        value: formatJson(example.value),
        context: {
          data: example.data,
          dataPath: example.dataPath,
        },
      }));
    },
    buildPreview({
      baseUrl,
      component,
      example,
      protocol,
      theme,
      value,
    }) {
      let parsedUsage: unknown;
      try {
        parsedUsage = JSON.parse(value) as unknown;
      } catch (error) {
        return {
          error: `Invalid JSON: ${String(error)}`,
          url: '',
          readyEmptyTitle: 'Fix the Usage JSON to update the preview.',
          invalidTitle: 'Fix the Usage JSON to update the preview.',
        };
      }

      return {
        error: '',
        url: buildRenderUrl(
          {
            protocol,
            demoUrl: DEFAULT_A2UI_DEMO_URL,
            messages: createComponentPreviewMessages(
              component,
              parsedUsage,
              example?.context,
            ),
            theme,
            instant: true,
          },
          baseUrl,
        ),
        readyEmptyTitle: 'Fix the Usage JSON to update the preview.',
        invalidTitle: 'Fix the Usage JSON to update the preview.',
      };
    },
  },
} satisfies ComponentCatalogSource<ComponentDoc, A2UIUsageContext>;
