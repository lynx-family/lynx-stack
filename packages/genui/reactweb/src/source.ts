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

/** The complete React DOM source accepted by the GenUI compiler. */
export type ReactWebSource = z.infer<typeof sourceSchema>;

/** Parse a bounded source response containing exactly App.tsx and App.css. */
export function parseReactWebSource(text: string): ReactWebSource {
  const json = text.trim().replace(/^```(?:json)?\s*/u, '').replace(
    /\s*```$/u,
    '',
  );
  if (json.length > 512_000) {
    throw new Error('ReactWeb source exceeds the 512 KB limit');
  }
  return sourceSchema.parse(JSON.parse(json));
}

/** Normalize a valid model response to the canonical source JSON. */
export function normalizeReactWebSource(text: string): string {
  return JSON.stringify(parseReactWebSource(text));
}
