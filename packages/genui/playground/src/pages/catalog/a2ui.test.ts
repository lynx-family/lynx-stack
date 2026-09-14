// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { createComponentPreviewMessages } from './a2ui.js';

describe('A2UI catalog preview', () => {
  test('uses v1.0, the registered catalog, and a canonical root', () => {
    const messages = createComponentPreviewMessages({
      id: 'title',
      component: 'Text',
      text: { path: '/title' },
    }, { data: { title: 'Hello' } });
    expect(messages).toEqual([
      {
        version: 'v1.0',
        createSurface: {
          surfaceId: 'default',
          catalogId: 'https://unpkg.com/@lynx-js/genui/a2ui/dist/catalog.json',
        },
      },
      {
        version: 'v1.0',
        updateDataModel: {
          surfaceId: 'default',
          path: '/',
          value: { title: 'Hello' },
        },
      },
      {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'default',
          components: [
            { id: 'root', component: 'Column', children: ['title'] },
            { id: 'title', component: 'Text', text: { path: '/title' } },
          ],
        },
      },
    ]);
  });
  test('keeps an existing root without wrapping it again', () => {
    const component = { id: 'root', component: 'Text', text: 'Hello' };
    expect(createComponentPreviewMessages(component)).toContainEqual({
      version: 'v1.0',
      updateComponents: { surfaceId: 'default', components: [component] },
    });
  });
});
