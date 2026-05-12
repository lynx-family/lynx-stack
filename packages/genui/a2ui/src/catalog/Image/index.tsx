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

  useEffect(() => {
    setHasError(false);
  }, [src]);

  return (
    <image
      key={props.id}
      className={`a2ui-image image-variant-${
        props.variant ?? 'mediumFeature'
      } ${typeof props.weight === 'number' ? 'image-weighted' : ''}`}
      src={hasError ? fallbackImage : src as string}
      mode={mode}
      binderror={() => setHasError(true)}
    />
  );
}
