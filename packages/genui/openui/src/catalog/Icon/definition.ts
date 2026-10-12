// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

const ICON_NAMES = [
  'account_circle',
  'add',
  'arrow_back',
  'arrow_forward',
  'camera',
  'check',
  'close',
  'delete',
  'edit',
  'error',
  'favorite',
  'help',
  'home',
  'info',
  'location_on',
  'lock',
  'mail',
  'menu',
  'more_vert',
  'pause',
  'person',
  'play_arrow',
  'refresh',
  'search',
  'send',
  'settings',
  'share',
  'star',
  'warning',
] as const;

/** Server-safe OpenUI definition for Icon, with a null renderer. */
export const Icon = defineComponent({
  name: 'Icon',
  props: z.object({
    name: z.enum(ICON_NAMES),
    size: z.enum(['sm', 'md', 'lg']).optional(),
    color: z.enum(['primary', 'muted', 'inherit']).optional(),
  }),
  description: 'Material icon.',
  component: () => null,
});
