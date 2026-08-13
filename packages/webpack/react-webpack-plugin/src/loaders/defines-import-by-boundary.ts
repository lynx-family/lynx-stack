// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export function boundaryKey(
  layer: string | null | undefined,
  resourcePath: string,
): string {
  return `${layer ?? ''}|${resourcePath}`;
}

export const definesImportByBoundary: Map<string, string> = new Map();
