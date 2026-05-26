// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { GenericComponentProps } from '../../store/types.js';

import '../../../styles/catalog/Image.css';

/**
 * @a2uiCatalog Image
 */
export interface ImageProps extends GenericComponentProps {
  /** Image URL or path binding. */
  url: string | { path: string };
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  mode?: 'scaleToFill' | 'aspectFit' | 'aspectFill' | 'center';
  variant?:
    | 'icon'
    | 'avatar'
    | 'smallFeature'
    | 'mediumFeature'
    | 'largeFeature'
    | 'header';
  weight?: number;
}

function imageSourceFromServer(value: unknown): string | undefined {
  const raw = typeof value === 'string'
    ? value
    : (value && typeof value === 'object'
        && typeof (value as { path?: unknown }).path === 'string'
      ? (value as { path: string }).path
      : undefined);
  const src = raw?.trim();
  if (!src) return undefined;
  return src;
}

export function Image(
  props: ImageProps,
): import('@lynx-js/react').ReactNode {
  const src = imageSourceFromServer(props.url);
  const fit = props.fit ?? 'fit';
  const mode = props.mode ?? (() => {
    switch (fit) {
      case 'contain':
      case 'scale-down':
        return 'aspectFit';
      case 'fill':
        return 'scaleToFill';
      case 'none':
        return 'center';
      default:
        return 'aspectFill';
    }
  })();

  const variant = props.variant ?? 'mediumFeature';
  const className = `a2ui-image image-variant-${variant} ${
    typeof props.weight === 'number' ? 'image-weighted' : ''
  }`;
  return (
    <image
      key={props.id}
      className={className}
      auto-size={true}
      src={src ?? ''}
      mode={mode}
    />
  );
}
