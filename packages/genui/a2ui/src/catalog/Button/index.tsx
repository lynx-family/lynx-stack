// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { A2UIRender } from '../../core/A2UIRender.jsx';
import type { GenericComponentProps } from '../../core/types.js';

import './style.css';

/**
 * Props for the Button catalog component.
 */
export interface ButtonActionContextBinding {
  path: string;
}

export type ButtonActionContextValue =
  | string
  | number
  | boolean
  | ButtonActionContextBinding;

export interface ButtonActionEvent {
  name: string;
  /** Context is a JSON object map in v0.9. */
  context?: Record<string, ButtonActionContextValue>;
}

export interface ButtonAction {
  event: ButtonActionEvent;
}

export interface ButtonProps extends GenericComponentProps {
  child: string;
  variant?: 'primary' | 'borderless';
  /**
   * v0.9 actions should use the `event` wrapper for server-dispatched clicks.
   */
  action: ButtonAction;
}

/**
 * Render an interactive button.
 */
export function Button(
  props: ButtonProps,
): import('@lynx-js/react').ReactNode {
  const { action, child, surface, sendAction } = props;

  const handleClick = () => {
    if (action) {
      void sendAction?.(action as unknown as Record<string, unknown>);
    }
  };

  const childResource = child
    ? surface.resources.get(child)
    : undefined;

  return (
    <view className='button' bindtap={handleClick}>
      {childResource
        ? <A2UIRender resource={childResource} />
        : <text>Button</text>}
    </view>
  );
}
