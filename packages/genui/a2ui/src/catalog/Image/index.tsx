// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useEffect, useState } from '@lynx-js/react';

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

const fallbackImage =
  'https://lf3-static.bytednsdoc.com/obj/eden-cn/zalzzh-ukj-lapzild-shpjpmmv-eufs/ljhwZthlaukjlkulzlp/built-in-images/logo.png';

function isLoadableImageSource(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const src = value.trim();
  if (!src) return false;
  if (/^(?:https?:|data:image\/|blob:|file:)/iu.test(src)) return true;
  if (/^(?:\/|\.\/|\.\.\/)/u.test(src)) return true;
  return /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/iu.test(src);
}

export function Image(
  props: ImageProps,
): import('@lynx-js/react').ReactNode {
  const src = props.url;
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

  const [hasError, setHasError] = useState(false);
  const variant = props.variant ?? 'mediumFeature';
  const className = `a2ui-image image-variant-${variant} ${
    typeof props.weight === 'number' ? 'image-weighted' : ''
  }`;
  const loadableSrc = isLoadableImageSource(src) ? src.trim() : undefined;

  useEffect(() => {
    setHasError(false);
  }, [loadableSrc]);

  return (
    <image
      key={props.id}
      className={className}
      auto-size={true}
      src={hasError || !loadableSrc ? fallbackImage : loadableSrc}
      mode={mode}
      binderror={() => setHasError(true)}
    />
  );
}
