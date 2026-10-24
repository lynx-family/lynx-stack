// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const OPENUI_GAP_VALUES = [
  'none',
  'xxs',
  'xs',
  's',
  'm',
  'l',
  'xl',
  '2xl',
] as const;

export type OpenUiGap = (typeof OPENUI_GAP_VALUES)[number];
