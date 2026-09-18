// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { KeyboardEventHandler, PointerEventHandler } from 'react';

export function PanelResizeHandle(props: {
  ariaLabel: string;
  ariaValueMax?: number;
  ariaValueMin?: number;
  ariaValueNow?: number;
  className?: string;
  isActive: boolean;
  isCompactLayout: boolean;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  title?: string;
}) {
  const {
    ariaLabel,
    ariaValueMax,
    ariaValueMin,
    ariaValueNow,
    className,
    isActive,
    isCompactLayout,
    onKeyDown,
    onPointerDown,
    title,
  } = props;
  const classNames = [
    'panelResizeHandle',
    className,
    isActive ? 'active' : undefined,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classNames}
      role='separator'
      aria-orientation={isCompactLayout ? 'horizontal' : 'vertical'}
      aria-label={ariaLabel}
      aria-valuemax={ariaValueMax}
      aria-valuemin={ariaValueMin}
      aria-valuenow={ariaValueNow}
      tabIndex={onKeyDown ? 0 : undefined}
      title={title ?? 'Drag to resize'}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
    />
  );
}
