// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { HTML_PREVIEW_SANDBOX, HtmlView } from './HtmlView.js';

describe('HtmlView', () => {
  test('renders source through an isolated script-capable srcDoc iframe', () => {
    const source = '<!doctype html><html><head></head><body></body></html>';
    const element = HtmlView({ source });
    const props = element.props as Record<string, unknown>;

    expect(props.srcDoc).toBe(source);
    expect(props.sandbox).toBe('allow-scripts');
    expect(props.referrerPolicy).toBe('no-referrer');
    expect(HTML_PREVIEW_SANDBOX).not.toContain('allow-same-origin');
  });
});
