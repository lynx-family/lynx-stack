/*
 * Copyright 2026 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { StyleSheetResource } from '../../../binary/client/client.js';
import {
  MagicHeader0,
  MagicHeader1,
  TemplateSectionLabel,
} from '../../constants.js';
import { wasmInstance } from '../wasm.js';

/**
 * Returns the content of the first section labelled `label` in an encoded web
 * bundle, or `undefined` when the bundle has no such section.
 *
 * The layout is the one `decode.worker.ts` streams: the two magic header
 * words, a version word, then `[label, length, content]` sections, all little
 * endian.
 */
export function readBundleSection(
  bundle: Uint8Array,
  label: number,
): Uint8Array | undefined {
  const view = new DataView(
    bundle.buffer,
    bundle.byteOffset,
    bundle.byteLength,
  );
  if (
    bundle.byteLength < 12
    || view.getUint32(0, true) !== MagicHeader0
    || view.getUint32(4, true) !== MagicHeader1
  ) {
    throw new Error('Not an encoded web bundle');
  }
  const version = view.getUint32(8, true);
  if (version > 1) {
    throw new Error(`Unsupported version: ${version}`);
  }
  let offset = 12;
  while (offset + 8 <= bundle.byteLength) {
    const sectionLabel = view.getUint32(offset, true);
    const length = view.getUint32(offset + 4, true);
    offset += 8;
    if (offset + length > bundle.byteLength) {
      throw new Error(
        `Unexpected EOF reading section content. Expected ${length} bytes.`,
      );
    }
    if (sectionLabel === label) {
      return bundle.subarray(offset, offset + length);
    }
    offset += length;
  }
  return undefined;
}

/**
 * Decodes the StyleInfo of a base64 encoded web bundle into a style sheet, the
 * way the decode worker does for a template that is loaded. Returns
 * `undefined` when the bundle has no StyleInfo.
 *
 * Used for CSS hot updates: `@lynx-js/css-extract-webpack-plugin` encodes all
 * the CSS of a template into such a bundle.
 *
 * @param entryName - The lazy bundle url, whose selectors are scoped to it, or
 * `undefined` for the card.
 */
export function createStyleSheetResourceFromBundle(
  base64Bundle: string,
  entryName: string | undefined,
  enableCSSSelector: boolean,
  transformVW: boolean,
  transformVH: boolean,
  transformREM: boolean,
  transformSP: boolean,
): StyleSheetResource | undefined {
  const styleInfo = readBundleSection(
    Uint8Array.from(atob(base64Bundle), (char) => char.charCodeAt(0)),
    TemplateSectionLabel.StyleInfo,
  );
  if (!styleInfo) {
    return undefined;
  }
  return new wasmInstance.StyleSheetResource(
    wasmInstance.decode_style_info(
      styleInfo,
      entryName,
      enableCSSSelector,
      transformVW,
      transformVH,
      transformREM,
      transformSP,
    ),
    document,
  );
}
