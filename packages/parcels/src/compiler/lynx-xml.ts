// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** @packageDocumentation Compile Lynx XML documents for embedding. */

import { xmlToTasmJSON } from '@lynx-js/web-core/encode';

import type { ParcelCode } from './index.js';

/**
 * Extract embeddable scripts and styles from a Lynx XML document.
 *
 * The document's main script must export the embedded lifecycle. Throws for
 * invalid markup or CSS at-rules the encoder discards.
 */
export function compileLynxXml(source: string): ParcelCode {
  const parsed = xmlToTasmJSON(source);
  if (!parsed.success) throw new Error(parsed.message);
  if (parsed.discarded.length > 0) {
    throw new Error(
      `Lynx XML CSS has unsupported at-rules: ${
        parsed.discarded.map(rule => rule.name).join(', ')
      }`,
    );
  }

  const xml = parsed.tasmJSON;
  return {
    main: xml.lepusCode['root']!,
    background: xml.manifest['/app-service.js'] ?? '',
    style: xml.styleInfo['0'] ?? [],
  };
}
