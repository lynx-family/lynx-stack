// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
/**
 * useOffset — touch handling + offset tracking + cross-thread sync.
 *
 * Port of React Lynx's Swiper/useOffset.ts.
 * All MTS function bodies are identical to the React version.
 */

import {
  runOnBackground,
  runOnMainThread,
  useMainThreadRef,
} from '@lynx-js/vue-runtime';

import { useAnimate } from '../utils/useAnimate.js';

export function useOffset({
  onOffsetUpdate,
  onIndexUpdate,
  itemWidth,
  dataLength,
  duration,
  MTEasing,
}: {
  onOffsetUpdate: (offset: number) => void;
  onIndexUpdate: (index: number) => void;
  itemWidth: number;
  dataLength: number;
  duration?: number;
  MTEasing?: (t: number) => number;
}) {
  const touchStartXRef = useMainThreadRef<number>(0);
  const touchStartCurrentOffsetRef = useMainThreadRef<number>(0);
  const currentOffsetRef = useMainThreadRef<number>(0);
  const currentIndexRef = useMainThreadRef<number>(0);
  const { animate, cancel: cancelAnimate } = useAnimate();

  function updateIndex(index: number) {
    const offset = -index * itemWidth;
    runOnMainThread(updateOffset)(offset);
  }

  function calcNearestPage(offset: number) {
    'main thread';
    const nearestPage = Math.round(offset / itemWidth);
    return nearestPage * itemWidth;
  }

  function updateOffset(offset: number) {
    'main thread';

    const lowerBound = 0;
    const upperBound = -(dataLength - 1) * itemWidth;

    const realOffset = Math.min(lowerBound, Math.max(upperBound, offset));
    currentOffsetRef.current = realOffset;
    onOffsetUpdate(realOffset);
    const index = Math.round(-realOffset / itemWidth);
    if (currentIndexRef.current !== index) {
      currentIndexRef.current = index;
      runOnBackground(onIndexUpdate)(index);
    }
  }

  function handleTouchStart(e: { touches: Array<{ clientX: number }> }) {
    'main thread';
    touchStartXRef.current = e.touches[0].clientX;
    touchStartCurrentOffsetRef.current = currentOffsetRef.current;
    cancelAnimate();
  }

  function handleTouchMove(e: { touches: Array<{ clientX: number }> }) {
    'main thread';
    const touchMoveX = e.touches[0].clientX;
    const deltaX = touchMoveX - touchStartXRef.current;
    updateOffset(touchStartCurrentOffsetRef.current + deltaX);
  }

  function handleTouchEnd() {
    'main thread';
    touchStartXRef.current = 0;
    touchStartCurrentOffsetRef.current = 0;
    animate({
      from: currentOffsetRef.current,
      to: calcNearestPage(currentOffsetRef.current),
      onUpdate: (offset: number) => {
        'main thread';
        updateOffset(offset);
      },
      duration,
      easing: MTEasing,
    });
  }

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    updateIndex,
  };
}
