// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useEffect, useState } from '@lynx-js/react';

import type { GenericComponentProps } from '../../core/types.js';

import '../../../styles/catalog/Image.css';

const useLynxEffect = useEffect as (
  effect: () => undefined | (() => void),
  deps?: readonly unknown[],
) => void;

/**
 * @a2uiCatalog Image
 */
export interface ImageProps extends GenericComponentProps {
  /** Image URL or path binding. */
  url: string | { path: string };
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  variant?:
    | 'icon'
    | 'avatar'
    | 'smallFeature'
    | 'mediumFeature'
    | 'largeFeature'
    | 'header';
}

export function Image(
  props: ImageProps,
): import('@lynx-js/react').ReactNode {
  const { id, url } = props;

  const [hasError, setHasError] = useState(false);

  useLynxEffect(() => {
    setHasError(false);
    return undefined;
  }, [url]);

  const finalSrc = hasError
    ? 'https://lf3-static.bytednsdoc.com/obj/eden-cn/zalzzh-ukj-lapzild-shpjpmmv-eufs/ljhwZthlaukjlkulzlp/built-in-images/logo.png'
    : url;

  return (
    <image
      key={id}
      src={finalSrc as string}
      className='a2ui-image mediumFeature'
      binderror={() => setHasError(true)}
    />
  );
}
