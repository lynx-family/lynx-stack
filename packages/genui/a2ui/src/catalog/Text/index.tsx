// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { GenericComponentProps } from '../../store/types.js';
import '../../../styles/catalog/Text.css';

/**
 * @a2uiCatalog Text
 */
export interface TextProps extends GenericComponentProps {
  /** Literal text, path binding, or function call. */
  text: string | { path: string } | {
    call: string;
    args: Record<string, unknown>;
    returnType?:
      | 'string'
      | 'number'
      | 'boolean'
      | 'array'
      | 'object'
      | 'any'
      | 'void';
  };
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'caption' | 'body' | 'markdown';
  emphasis?: 'medium' | 'strong';
}

export function Text(
  props: TextProps,
): import('@lynx-js/react').ReactNode {
  const id = props.id;
  const text = props.text as string;
  const variant = props.variant ?? 'body';
  const emphasisClass = props.emphasis ? `text-emphasis-${props.emphasis}` : '';

  if (variant === 'markdown') {
    return (
      // @ts-expect-error support markdown future
      <x-markdown content={text} />
    );
  }
  return (
    <text key={id} className={`text-${variant} ${emphasisClass}`}>
      {text}
    </text>
  );
}
