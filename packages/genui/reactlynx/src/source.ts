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

export type ReactLynxSource = z.infer<typeof sourceSchema>;

export function parseReactLynxSource(text: string): ReactLynxSource {
  const json = text.trim().replace(/^```(?:json)?\s*/u, '').replace(
    /\s*```$/u,
    '',
  );
  if (json.length > 512_000) {
    throw new Error('ReactLynx source exceeds the 512 KB limit');
  }
  return sourceSchema.parse(JSON.parse(json));
}

export function normalizeReactLynxSource(text: string): string {
  return JSON.stringify(parseReactLynxSource(text));
}
