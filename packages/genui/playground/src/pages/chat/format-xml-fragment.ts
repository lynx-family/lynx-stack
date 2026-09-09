// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import xmlFormat from 'xml-formatter';

/** Derive a display-only version, allowing multiple fragment roots. */
export function formatXmlFragment(source: string): string | undefined {
  const open = '<genui-fragment>';
  const close = '</genui-fragment>';
  try {
    const formatted = xmlFormat(`${open}${source}${close}`, {
      indentation: '  ',
      lineSeparator: '\n',
      collapseContent: true,
      strictMode: true,
    });
    const inner = formatted.slice(open.length, -close.length);
    return inner.startsWith('\n')
      ? inner.slice(1).replace(/\n$/u, '').replace(/^ {2}/gmu, '')
      : inner;
  } catch {
    // Older or incomplete artifacts must still expose their exact raw source.
    return undefined;
  }
}
