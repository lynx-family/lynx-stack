// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseResizablePanelsOptions {
  breakpoint: number;
  disabled?: boolean;
  initialPrimarySize: number;
  initialSecondarySize: number;
  desktopPrimaryMinSize: number;
  desktopSecondaryMinSize: number;
  compactPrimaryMinSize: number;
  compactSecondaryMinSize: number;
  desktopOffsetSelector?: string;
  compactOffsetSelector?: string;
}

interface UseResizablePanelsResult {
  containerRef: RefObject<HTMLDivElement | null>;
  isCompactLayout: boolean;
  isResizing: boolean;
  primaryPanelStyle: CSSProperties | undefined;
  secondaryPanelStyle: CSSProperties | undefined;
  handleResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function readElementSize(
  root: HTMLDivElement,
  selector: string | undefined,
  axis: 'width' | 'height',
): number {
  if (!selector) {
    return 0;
  }
  const element = root.querySelector(selector);
  if (!element) {
    return 0;
  }
  const rect = element.getBoundingClientRect();
  return axis === 'width' ? rect.width : rect.height;
}

export function useResizablePanels(
  options: UseResizablePanelsOptions,
): UseResizablePanelsResult {
  const {
    breakpoint,
    compactOffsetSelector,
    compactPrimaryMinSize,
    compactSecondaryMinSize,
    desktopOffsetSelector,
    desktopPrimaryMinSize,
    desktopSecondaryMinSize,
    disabled = false,
    initialPrimarySize,
    initialSecondarySize,
  } = options;

  const [secondarySize, setSecondarySize] = useState(initialSecondarySize);
  const [primarySize, setPrimarySize] = useState(initialPrimarySize);
  const [isResizing, setIsResizing] = useState(false);
  const [isCompactLayout, setIsCompactLayout] = useState(
    () => window.innerWidth <= breakpoint,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const stopResizeRef = useRef<((updateState?: boolean) => void) | null>(null);

  useEffect(() => {
    const updateLayoutMode = () => {
      setIsCompactLayout(window.innerWidth <= breakpoint);
    };
    updateLayoutMode();
    window.addEventListener('resize', updateLayoutMode);
    return () => window.removeEventListener('resize', updateLayoutMode);
  }, [breakpoint]);

  useEffect(() => {
    if (disabled) {
      stopResizeRef.current?.(false);
    }
  }, [disabled]);

  useEffect(() => {
    return () => {
      stopResizeRef.current?.(false);
    };
  }, []);

  const handleResizeStart = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (disabled || !containerRef.current) {
      return;
    }

    event.preventDefault();
    stopResizeRef.current?.();

    const container = containerRef.current;
    const compact = window.innerWidth <= breakpoint;
    const startX = event.clientX;
    const startY = event.clientY;
    const startSecondarySize = secondarySize;
    const startPrimarySize = primarySize;

    setIsResizing(true);
    document.body.dataset.panelResize = compact ? 'vertical' : 'horizontal';

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const containerRect = container.getBoundingClientRect();

      if (compact) {
        const offset = readElementSize(
          container,
          compactOffsetSelector,
          'height',
        );
        const maxPrimarySize = containerRect.height
          - offset
          - compactSecondaryMinSize;
        setPrimarySize(
          clamp(
            startPrimarySize + moveEvent.clientY - startY,
            compactPrimaryMinSize,
            maxPrimarySize,
          ),
        );
        return;
      }

      const offset = readElementSize(container, desktopOffsetSelector, 'width');
      const maxSecondarySize = containerRect.width
        - offset
        - desktopPrimaryMinSize;
      setSecondarySize(
        clamp(
          startSecondarySize + startX - moveEvent.clientX,
          desktopSecondaryMinSize,
          maxSecondarySize,
        ),
      );
    };

    const stopResize = (updateState = true) => {
      if (updateState) {
        setIsResizing(false);
      }
      delete document.body.dataset.panelResize;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerStop);
      window.removeEventListener('pointercancel', handlePointerStop);
      stopResizeRef.current = null;
    };
    const handlePointerStop = () => stopResize();

    stopResizeRef.current = stopResize;
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerStop);
    window.addEventListener('pointercancel', handlePointerStop);
  }, [
    breakpoint,
    compactOffsetSelector,
    compactPrimaryMinSize,
    compactSecondaryMinSize,
    desktopOffsetSelector,
    desktopPrimaryMinSize,
    desktopSecondaryMinSize,
    disabled,
    primarySize,
    secondarySize,
  ]);

  return {
    containerRef,
    handleResizeStart,
    isCompactLayout,
    isResizing,
    primaryPanelStyle: isCompactLayout && !disabled
      ? { height: `${primarySize}px` }
      : undefined,
    secondaryPanelStyle: !isCompactLayout && !disabled
      ? { width: `${secondarySize}px` }
      : undefined,
  };
}
