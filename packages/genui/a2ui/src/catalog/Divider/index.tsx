// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { GenericComponentProps } from '../../core/types.js';

import './style.css';

export interface DividerProps extends GenericComponentProps {
  axis?: 'horizontal' | 'vertical';
}

export function Divider(
  props: DividerProps,
): import('@lynx-js/react').ReactNode {
  const id = props.id;
  const axis = props.axis as string | undefined ?? 'horizontal';
  return <view key={id} className={`divider divider-${axis}`} />;
}
