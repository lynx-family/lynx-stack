// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { OPENUI_COMPONENT_CATALOG } from './openui.js';
import { parseOpenUIScenario } from '../mock/openui-scenarios.js';
import {
  buildOpenUIRenderUrl,
  canInlineOpenUIRenderUrl,
} from '../utils/renderUrl.js';

describe('OpenUI component preview usage', () => {
  test.each(OPENUI_COMPONENT_CATALOG)(
    '$name has valid inline preview DSL',
    (component) => {
      const result = parseOpenUIScenario(component.usage);
      expect(result.root).not.toBeNull();
      expect(result.meta.errors).toEqual([]);
      expect(result.meta.incomplete).toBe(false);
      expect(result.meta.unresolved).toEqual([]);

      const url = buildOpenUIRenderUrl({
        rawText: component.usage,
        instant: true,
      }, 'https://lynx-stack.dev/genui/');
      expect(canInlineOpenUIRenderUrl(url)).toBe(true);
    },
  );

  test('reports malformed DSL through the parse result', () => {
    const result = parseOpenUIScenario('root = Unknown()');

    expect(result.root).toBeNull();
    expect(result.meta.errors[0]?.code).toBe('unknown-component');
  });
});
