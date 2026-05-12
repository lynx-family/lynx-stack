// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { GenericComponentProps } from '../../store/types.js';
import '../../../styles/catalog/Text.css';

/**
 * @a2uiCatalog Text
 */
export interface TextProps extends GenericComponentProps {
  /** Literal text or path binding. */
  text: string | { path: string };
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'caption' | 'body';
  weight?: number;
}

export function Text(
  props: TextProps,
): import('@lynx-js/react').ReactNode {
  const id = props.id;
  const text = props.text;
  const variant = props.variant ?? 'body';
  const weight = props.weight;
  let weightClass = '';
  if (typeof weight === 'number') {
    if (weight >= 2) {
      weightClass = 'text-weight-2';
    } else if (weight >= 1.5) {
      weightClass = 'text-weight-1-5';
    } else {
      weightClass = 'text-weight-1';
    }
  }

  return (
    <text key={id} className={`text-${variant} ${weightClass}`}>
      {text as string}
    </text>
  );
}
