// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { A2UIRender } from '../../core/A2UIRender.jsx';
import type { GenericComponentProps } from '../../core/types.js';

import './style.css';

export function Button(
  props: GenericComponentProps,
): import('@lynx-js/react').ReactNode {
  const { action, child, surface, sendAction } = props;

  const handleClick = () => {
    if (action) {
      void sendAction?.(action as Record<string, unknown>);
    }
  };

  const childResource = child
    ? surface.resources.get(child as string)
    : undefined;

  return (
    <view className='button' bindtap={handleClick}>
      {childResource
        ? <A2UIRender resource={childResource} />
        : <text>Button</text>}
    </view>
  );
}
