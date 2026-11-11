// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { z } from 'zod';

const sourceSchema = z.object({
  files: z.object({
    'App.tsx': z.string().min(1).max(256_000),
    'App.css': z.string().max(128_000),
  }).strict(),
}).strict();

/** Complete generated ReactLynx source containing only `App.tsx` and `App.css`. */
export interface ReactLynxSource {
  /** The complete component and stylesheet files. */
  files: {
    /** Non-empty TSX source that default-exports the App function component. */
    'App.tsx': string;
    /** Plain CSS loaded by the host entry point; may be empty. */
    'App.css': string;
  };
}

function parseSourceJson(json: string): unknown {
  try {
    return JSON.parse(json) as unknown;
  } catch (error) {
    // The model can finish both file strings but omit the enclosing braces.
    // Appending braces cannot complete a truncated string or fix invalid code.
    for (const suffix of ['}', '}}']) {
      if (json.length + suffix.length > 512_000) break;
      try {
        return JSON.parse(json + suffix) as unknown;
      } catch {
        // Keep the original parse error if neither complete envelope is valid.
      }
    }
    throw error;
  }
}

/**
 * Parse JSON or a JSON code fence and validate the two-file source contract.
 *
 * @throws When JSON is invalid, files are missing or extra, or source limits are exceeded.
 */
export function parseReactLynxSource(text: string): ReactLynxSource {
  const json = text.trim().replace(/^```(?:json)?\s*/u, '').replace(
    /\s*```$/u,
    '',
  );
  if (json.length > 512_000) {
    throw new Error('ReactLynx source exceeds the 512 KB limit');
  }
  return sourceSchema.parse(parseSourceJson(json));
}

/** Validate generated source and serialize it as canonical two-file JSON. */
export function normalizeReactLynxSource(text: string): string {
  return JSON.stringify(parseReactLynxSource(text));
}
