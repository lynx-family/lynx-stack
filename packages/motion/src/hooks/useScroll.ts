// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { MotionValue } from 'motion-dom';

import { useMainThreadRef } from '@lynx-js/react';
import type { MainThread, ScrollEvent } from '@lynx-js/types';

import { useMotionValue } from './useMotionValue.js';

interface Viewport {
  width: number;
  height: number;
}
type MainThreadScrollEvent = Pick<ScrollEvent, 'detail'> & {
  currentTarget: MainThread.Element;
};

export interface ScrollMotionValues {
  scrollX: MotionValue<number>;
  scrollY: MotionValue<number>;
  scrollXProgress: MotionValue<number>;
  scrollYProgress: MotionValue<number>;
  onScroll: (event: MainThreadScrollEvent) => void;
  onLayoutChange: (event: Pick<MainThread.LayoutChangeEvent, 'detail'>) => void;
}

/**
 * Track a Lynx scroll-view. Bind the returned handlers to
 * `main-thread:bindscroll` and `main-thread:bindlayoutchange`.
 */
export function useScroll(): ScrollMotionValues {
  const scrollX = useMotionValue(0);
  const scrollY = useMotionValue(0);
  const scrollXProgress = useMotionValue(0);
  const scrollYProgress = useMotionValue(0);
  const viewport = useMainThreadRef({ width: 0, height: 0 });
  const content = useMainThreadRef({ width: 0, height: 0 });
  const measuring = useMainThreadRef(false);

  function updateProgress() {
    'main thread';
    const horizontalRange = content.current.width - viewport.current.width;
    const verticalRange = content.current.height - viewport.current.height;
    scrollXProgress.set(
      viewport.current.width > 0 && horizontalRange > 0
        ? Math.min(1, scrollX.get() / horizontalRange)
        : 0,
    );
    scrollYProgress.set(
      viewport.current.height > 0 && verticalRange > 0
        ? Math.min(1, scrollY.get() / verticalRange)
        : 0,
    );
  }

  function onScroll({ detail, currentTarget }: MainThreadScrollEvent) {
    'main thread';
    content.current = {
      width: detail.scrollWidth,
      height: detail.scrollHeight,
    };
    scrollX.set(Math.max(0, detail.scrollLeft));
    scrollY.set(Math.max(0, detail.scrollTop));
    updateProgress();

    // A first-screen layout event can arrive before the scroll binding is
    // installed. Measure once on the first scroll when the viewport is unknown.
    if (viewport.current.width > 0 || measuring.current) return;
    measuring.current = true;
    void currentTarget.invoke('boundingClientRect').then((rect: Viewport) => {
      if (viewport.current.width === 0) {
        viewport.current = { width: rect.width, height: rect.height };
        updateProgress();
      }
    }, () => {
      // Keep the last known viewport and retry on a later scroll.
    }).finally(() => {
      measuring.current = false;
    });
  }

  function onLayoutChange(
    { detail }: Pick<MainThread.LayoutChangeEvent, 'detail'>,
  ) {
    'main thread';
    viewport.current = { width: detail.width, height: detail.height };
    updateProgress();
  }

  return {
    scrollX,
    scrollY,
    scrollXProgress,
    scrollYProgress,
    onScroll,
    onLayoutChange,
  };
}
