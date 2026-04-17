// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type * as v0_9 from '@a2ui/web_core/v0_9';

import type { ComponentProps } from '../../core/ComponentRegistry.js';
import type { GenericComponentProps } from '../../core/types.js';

import './style.css';

export interface DividerProps extends ComponentProps {
  component: v0_9.AnyComponent & { dataContextPath?: string };
}

export function Divider(
  props: GenericComponentProps,
): import('@lynx-js/react').ReactNode {
  const id = props.id;
  const axis = props['axis'] as string | undefined ?? 'horizontal';
  return <view key={id} className={`divider divider-${axis}`} />;
}
