// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { PointerEventHandler } from 'react';

export function PanelResizeHandle(props: {
  isActive: boolean;
  isCompactLayout: boolean;
  ariaLabel: string;
  title?: string;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
}) {
  const { ariaLabel, isActive, isCompactLayout, onPointerDown, title } = props;

  return (
    <div
      className={isActive
        ? 'panelResizeHandle active'
        : 'panelResizeHandle'}
      role='separator'
      aria-orientation={isCompactLayout ? 'horizontal' : 'vertical'}
      aria-label={ariaLabel}
      title={title ?? 'Drag to resize'}
      onPointerDown={onPointerDown}
    />
  );
}
