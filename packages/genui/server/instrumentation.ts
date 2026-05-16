// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export function register(): void {
  if (process.env['NEXT_RUNTIME'] !== 'nodejs') return;
  const { OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL } = process.env;
  const missing: string[] = [];
  if (!OPENAI_API_KEY) missing.push('OPENAI_API_KEY');
  if (!OPENAI_BASE_URL) missing.push('OPENAI_BASE_URL');
  if (!OPENAI_MODEL) missing.push('OPENAI_MODEL');

  if (missing.length === 0) return;

  const message =
    `[a2ui-server] missing required environment variables: ${
      missing.join(', ')
    }.\n`
    + 'See packages/genui/server/AGENTS.md for setup instructions.';
  if (process.env.NODE_ENV === 'production') {
    throw new Error(message);
  } else {
    console.warn(message);
  }
}
