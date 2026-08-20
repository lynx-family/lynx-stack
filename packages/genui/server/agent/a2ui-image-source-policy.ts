// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createA2UISourcePolicy } from './a2ui-source-policy.js';
import { isLoadableImageSource } from './a2ui-validator.js';

function normalizeImageSource(source: string): string | undefined {
  const trimmed = source.trim();
  if (!isLoadableImageSource(trimmed)) return undefined;
  if (!/^https?:/iu.test(trimmed)) return trimmed;

  try {
    return new URL(trimmed).toString();
  } catch {
    return undefined;
  }
}

export function createA2UIImageSourcePolicy(
  providedValues: readonly unknown[],
  dynamicSources: () => readonly string[] = () => [],
): (source: string) => boolean {
  return createA2UISourcePolicy(
    providedValues,
    normalizeImageSource,
    dynamicSources,
  );
}
