// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface CSSSourceMap {
  file?: string | undefined;
  mappings: string;
  names?: string[] | undefined;
  sourceRoot?: string | undefined;
  sources: string[];
  sourcesContent?: (string | null)[] | undefined;
  version: number;
}
