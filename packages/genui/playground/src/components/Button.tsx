// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { ICON_SIZE } from './Icon.js';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon rendered before the label. Pass a Lucide icon component. */
  iconBefore?: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  iconAfter?: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  /** Render as icon-only (square aspect, no label). */
  iconOnly?: boolean;
  /** Collapse to icon-only at narrow widths (≤720px). Requires iconBefore. */
  responsiveIconOnly?: boolean;
  /** Make the button stretch to its container's width. */
  fullWidth?: boolean;
  children?: ReactNode;
}

function classes(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(props, ref) {
    const {
      variant = 'secondary',
      size = 'md',
      iconBefore: IconBefore,
      iconAfter: IconAfter,
      iconOnly = false,
      responsiveIconOnly = false,
      fullWidth = false,
      className,
      children,
      type = 'button',
      ...rest
    } = props;

    const iconSize =
      ICON_SIZE[size === 'lg' ? 'lg' : (size === 'sm' ? 'sm' : 'md')];

    return (
      <button
        ref={ref}
        type={type}
        className={classes(
          'btn',
          `btn-${variant}`,
          `btn-${size}`,
          iconOnly && 'btn-iconOnly',
          responsiveIconOnly && 'btn-responsiveIconOnly',
          fullWidth && 'btn-fullWidth',
          className,
        )}
        {...rest}
      >
        {IconBefore
          ? <IconBefore size={iconSize} strokeWidth={2} />
          : null}
        {iconOnly ? null : <span className='btnLabel'>{children}</span>}
        {IconAfter ? <IconAfter size={iconSize} strokeWidth={2} /> : null}
      </button>
    );
  },
);
