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

export function createComponentPreviewMessages(
  usage: unknown,
  context?: A2UIUsageContext,
): unknown[] {
  const components = Array.isArray(usage) ? [...usage as unknown[]] : [usage];
  const first = components[0] as { id?: unknown } | undefined;
  if (
    first && typeof first.id === 'string'
    && !components.some(item =>
      (item as { id?: unknown } | null)?.id === 'root'
    )
  ) {
    components.unshift({
      id: 'root',
      component: 'Column',
      children: [first.id],
    });
  }
  const messages: unknown[] = [
    {
      version: 'v1.0',
      createSurface: {
        surfaceId: 'default',
        catalogId: 'https://unpkg.com/@lynx-js/genui/a2ui/dist/catalog.json',
      },
    },
  ];
  if (context?.data !== undefined) {
    messages.push({
      version: 'v1.0',
      updateDataModel: {
        surfaceId: 'default',
        path: context.dataPath ?? '/',
        value: context.data,
      },
    });
  }
  messages.push({
    version: 'v1.0',
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
