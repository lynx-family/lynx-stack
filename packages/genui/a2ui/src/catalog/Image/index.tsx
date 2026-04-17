// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useEffect, useState } from '@lynx-js/react';

import type { GenericComponentProps } from '../../core/types.js';

import './style.css';

export function Image(
  props: GenericComponentProps,
): import('@lynx-js/react').ReactNode {
  const { id, url } = props;

  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
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
