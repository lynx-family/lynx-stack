// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { GenericComponentProps } from '../../core/types.js';
import './style.css';

export function Text(
  props: GenericComponentProps,
): import('@lynx-js/react').ReactNode {
  const id = props.id;
  const text = props['text'];
  const variant = props['variant'] as string | undefined ?? 'body';

  return (
    <text key={id} className={`text-${variant}`}>
      {text as string}
    </text>
  );
}
