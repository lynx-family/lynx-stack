// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { A2UIRenderer } from '../../react/A2UIRenderer.jsx';
import { useChecks } from '../../react/useChecks.js';
import type { CheckLike } from '../../react/useChecks.js';
import type { ComponentId, GenericComponentProps } from '../../store/types.js';

import '../../../styles/catalog/Button.css';

/**
 * Props for the built-in Button catalog component.
 *
 * @a2uiCatalog Button
 */
export interface ButtonProps extends GenericComponentProps {
  /** @a2uiComponentId */
  child: ComponentId;
  variant?: 'primary' | 'borderless';
  isValid?: boolean;
  /** v1.0 actions should use the `event` wrapper for server-dispatched clicks. */
  action: {
    event: {
      name: string;
      userMessage?: string | { path: string } | {
        call: string;
        catalogId?: string;
        args?: Record<string, unknown>;
      };
      /** Context is a JSON object map in v1.0. */
      context?: Record<string, unknown>;
    };
  } | {
    functionCall: {
      call: string;
      catalogId?: string;
      args: Record<string, unknown>;
    };
  };
  checks?: Array<{
    condition: { path: string } | {
      call: string;
      catalogId?: string;
      args: Record<string, unknown>;
    };
    /** Fallback when the validation result does not include a message. */
    message?: string;
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
