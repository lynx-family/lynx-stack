// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  OPENUI_CATEGORIES,
  OPENUI_COMPONENT_CATALOG,
} from '../../catalog/openui.js';
import type { OpenUIComponentDoc } from '../../catalog/openui.js';
import type { ComponentCatalogSource } from '../../components/ComponentCatalog.js';
import { parseOpenUIScenario } from '../../mock/openui-scenarios.js';
import {
  buildOpenUIRenderUrl,
  canInlineOpenUIRenderUrl,
} from '../../utils/renderUrl.js';

function getOpenUIParseError(raw: string): string {
  const result = parseOpenUIScenario(raw);
  const validationError = result.meta.errors[0];
  if (validationError) return validationError.message;
  if (!result.root) return 'No root component could be parsed.';
  if (result.meta.incomplete) return 'OpenUI DSL is incomplete.';
  if (result.meta.unresolved.length > 0) {
    return `Unresolved references: ${result.meta.unresolved.join(', ')}.`;
  }
  return '';
}

export const OPENUI_COMPONENT_CATALOG_SOURCE = {
  categories: OPENUI_CATEGORIES,
  components: OPENUI_COMPONENT_CATALOG,
  routeSegment: 'components',
  headerTitle: 'OpenUI Catalog',
  headerDescription:
    'Browse the OpenUI DSL component catalog, prop contracts, and usage snippets.',
  gridDescription: 'Browse all supported OpenUI components by category.',
  usage: {
    editorLabel: 'OpenUI DSL',
    sideHint: 'OpenUI DSL editor and live phone preview',
    hint:
      'Edit the OpenUI DSL below to change the component preview instantly.',
    propsHint:
      'Reference the available props before editing the OpenUI DSL below.',
    getExamples(component) {
      return [{ label: 'Default', value: component.usage }];
    },
    buildPreview({ baseUrl, theme, value }) {
      if (!value.trim()) {
        return {
          error: '',
          url: '',
          readyEmptyTitle: 'Enter OpenUI DSL to update the preview.',
          invalidTitle: 'Enter OpenUI DSL to update the preview.',
        };
      }

      const parseError = getOpenUIParseError(value);
      if (parseError) {
        return {
          error: `Invalid OpenUI DSL: ${parseError}`,
          url: '',
          readyEmptyTitle: 'Enter OpenUI DSL to update the preview.',
          invalidTitle: 'Fix the OpenUI DSL to update the preview.',
        };
      }

      const url = buildOpenUIRenderUrl(
        { rawText: value, theme, instant: true },
        baseUrl,
      );
      if (!canInlineOpenUIRenderUrl(url)) {
        return {
          error: 'OpenUI DSL is too large for an inline component preview.',
          url: '',
          readyEmptyTitle: 'Enter OpenUI DSL to update the preview.',
          invalidTitle: 'Fix the OpenUI DSL to update the preview.',
        };
      }

      return {
        error: '',
        url,
        readyEmptyTitle: 'Enter OpenUI DSL to update the preview.',
        invalidTitle: 'Enter OpenUI DSL to update the preview.',
      };
    },
  },
} satisfies ComponentCatalogSource<OpenUIComponentDoc>;
