// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { GenericComponentProps } from '../../store/types.js';

import '../../../styles/catalog/Image.css';

/**
 * Props for the built-in Image catalog component.
 *
 * @a2uiCatalog Image
 */
export interface ImageProps extends GenericComponentProps {
  /** Image URL or path binding. */
  url: string;
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

/**
 * Render an image URL with catalog-defined sizing and fit variants.
 */
export function Image(
  props: ImageProps,
): import('@lynx-js/react').ReactNode {
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
      src={props.url ?? ''}
      mode={mode}
    />
  );
}
