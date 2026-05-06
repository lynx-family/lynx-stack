// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { A2UIRenderer } from '../../react/A2UIRenderer.jsx';
import type { GenericComponentProps } from '../../store/types.js';

import '../../../styles/catalog/Button.css';

/**
 * @a2uiCatalog Button
 */
export interface ButtonProps extends GenericComponentProps {
  child: string;
  variant?: 'primary' | 'borderless';
  /** v0.9 actions should use the `event` wrapper for server-dispatched clicks. */
  action: {
    event: {
      name: string;
      /** Context is a JSON object map in v0.9. */
      context?: Record<string, string | number | boolean | { path: string }>;
    };
  };
}

export function Button(
  props: ButtonProps,
): import('@lynx-js/react').ReactNode {
  const { action, child, surface, sendAction } = props;

  const handleClick = () => {
    if (action) {
      void sendAction?.(action as Record<string, unknown>);
    }
  };

  const childResource = child
    ? surface.resources.get(child)
    : undefined;

  return (
    <view className='button' bindtap={handleClick}>
      {childResource
        ? <A2UIRenderer resource={childResource} />
        : <text>Button</text>}
    </view>
  );
}
