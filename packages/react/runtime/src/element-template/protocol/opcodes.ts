// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const ElementTemplateUpdateOps = {
  createTemplate: 1,
  setAttribute: 2,
  insertNode: 3,
  removeNode: 4,
} as const;

export type ElementTemplateUpdateOp = typeof ElementTemplateUpdateOps[keyof typeof ElementTemplateUpdateOps];
