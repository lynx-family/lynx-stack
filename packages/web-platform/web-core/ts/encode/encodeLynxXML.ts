// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The build-time half of the markup path: a Lynx XML document in, a
 * `.web.bundle` out.
 *
 * Split from the conversion itself, which now lives in
 * `ts/common/xml/xmlToTasmJSON.ts`, because the browser needs the conversion but
 * must not reach this file: {@link encode} pulls in `encodeCSS`, and through it
 * the `binary/encode` wasm glue, whose loader is `node:fs` based. Keeping the
 * `encode` call in a separate module is what lets the markup chunk import the
 * conversion without dragging Node into a browser bundle.
 *
 * The bytes produced here are an ordinary modern bundle - same magic header, same
 * sections, same rkyv-encoded `StyleInfo` - so the existing decoder consumes them
 * with no markup-specific handling.
 */

import type { DiscardedAtRule } from '../common/xml/xmlToTasmJSON.js';
import { xmlToTasmJSON } from '../common/xml/xmlToTasmJSON.js';
import { encode } from './webEncoder.js';

/**
 * Builds a `.web.bundle` from a Lynx XML markup document.
 *
 * Discarded at-rules are reported on the console as well as returned, because
 * the common caller is a build script that would otherwise drop the information
 * on the floor. This is unconditional, unlike the browser path's equivalent,
 * because a build has no production runtime to stay quiet for.
 */
export function encodeLynxXML(
  source: string,
): { success: true; buffer: Uint8Array; discarded: DiscardedAtRule[] } | {
  success: false;
  message: string;
} {
  const result = xmlToTasmJSON(source);
  if (!result.success) {
    return result;
  }

  for (const { name, reason } of result.discarded) {
    console.warn(
      reason === 'unrepresentable'
        ? `[lynx-web] ${name} has no representation in the Lynx style format and was dropped from the bundle, along with the rules inside it. It is not supported on any Lynx platform.`
        : reason === 'unsupported'
        ? `[lynx-web] ${name} is not recognised by the Lynx CSS parser and was dropped from the bundle, along with the rules inside it.`
        : `[lynx-web] ${name} with a URL cannot be resolved for a markup card, which owns a single stylesheet, and was dropped from the bundle.`,
    );
  }

  return {
    success: true,
    buffer: encode(result.tasmJSON),
    discarded: result.discarded,
  };
}
