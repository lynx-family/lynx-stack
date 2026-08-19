// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { A2UIRenderer } from '../../react/A2UIRenderer.jsx';
import { useChecks } from '../../react/useChecks.js';
import type { CheckLike } from '../../react/useChecks.js';
import type {
  GenericComponentProps,
  V1FunctionCall,
} from '../../store/types.js';

import '../../../styles/catalog/Button.css';

/**
 * Props for the built-in Button catalog component.
 *
 * @a2uiCatalog Button
 */
export interface ButtonProps extends GenericComponentProps {
  child: string;
  variant?: 'primary' | 'borderless';
  isValid?: boolean;
  /** Agent-dispatched actions use the protocol's `event` wrapper. */
  action: {
    event: {
      name: string;
      /** Context is resolved before the action is forwarded to the host. */
      context?: Record<string, unknown>;
      /** Optional renderer-to-agent text introduced in A2UI v1.0. */
      userMessage?: string | { path: string } | V1FunctionCall;
    };
  } | {
    functionCall: V1FunctionCall;
  };
  checks?: Array<{
    condition: boolean | { path: string } | V1FunctionCall;
    message: string;
  }>;
}

/**
 * Render an interactive button that dispatches an A2UI event or function call.
 */
export function Button(
  props: ButtonProps,
): import('@lynx-js/react').ReactNode {
  const {
    action,
    child,
    id,
    isValid = true,
    surface,
    sendAction,
    variant = 'primary',
    dataContextPath,
  } = props;
  const checks = props.checks as CheckLike[] | undefined;
  const { ok, firstFailureMessage } = useChecks({
    checks,
    componentId: id ?? '',
    surface,
    dataContextPath,
  });

  // The button is interactive only when both gates pass: `isValid` (the
  // agent's imperative "disabled" signal) and `ok` (the data-driven result
  // of evaluating the `checks` array).
  const enabled = isValid && ok;

  const handleClick = () => {
    if (enabled && action) {
      void sendAction?.(action as Record<string, unknown>);
    }
  };

  const childResource = child
    ? surface.resources.get(child)
    : undefined;

  return (
    <>
      <view
        className={`button button-${variant}${
          isValid ? '' : ' button-disabled'
        }${ok ? '' : ' button-invalid'}`}
        bindtap={enabled ? handleClick : undefined}
      >
        {childResource
          ? <A2UIRenderer resource={childResource} />
          : <text className='button-fallback'>Button</text>}
      </view>
      {!ok && firstFailureMessage
        ? <text className='button-error'>{firstFailureMessage}</text>
        : null}
    </>
  );
}
