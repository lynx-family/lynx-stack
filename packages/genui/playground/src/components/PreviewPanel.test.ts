// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { createPreviewQrCards } from './PreviewPanel.js';

describe('PreviewPanel QR cards', () => {
  test('keeps unavailable QR cards visible for edited Lynx XML', () => {
    const cards = createPreviewQrCards(
      {
        kind: 'lynx-xml',
        source: '<lynx></lynx>',
        theme: 'light',
      },
      '',
      '',
    );

    expect(cards).toHaveLength(2);
    expect(cards.map(({ key }) => key)).toEqual([
      'webPreview',
      'nativePreview',
    ]);
    expect(cards.every(({ item }) => item.url === undefined)).toBe(true);
    expect(cards.map(({ item }) => item.placeholder)).toEqual([
      'QR unavailable for local edits',
      'QR unavailable for local edits',
    ]);
  });

  test('uses shareable URLs for an unedited Lynx XML example', () => {
    const renderShareUrl =
      'https://lynx-stack.dev/genui/render.html?protocol=lynx-xml';
    const lynxDevUrl =
      'https://lynx-stack.dev/genui/demos/lynx-xml/counter.lynxml';
    const cards = createPreviewQrCards(
      {
        kind: 'lynx-xml',
        source: '<lynx></lynx>',
        sourcePath: 'demos/lynx-xml/counter.lynxml',
        theme: 'light',
      },
      renderShareUrl,
      lynxDevUrl,
    );

    expect(cards.map(({ item }) => item.url)).toEqual([
      renderShareUrl,
      lynxDevUrl,
    ]);
    expect(cards.every(({ item }) => item.showQrCode === true)).toBe(true);
  });
});
