// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
/**
 * useUpdateSwiperStyle — containerRef + style update composable.
 *
 * Port of React Lynx's Swiper/useUpdateSwiperStyle.ts.
 * MTS function body is identical to the React version.
 */

import { useMainThreadRef } from '@lynx-js/vue-runtime';

export function useUpdateSwiperStyle() {
  const containerRef = useMainThreadRef<unknown>(null);

  function updateSwiperStyle(offset: number) {
    'main thread';
    (
      containerRef as unknown as {
        current?: { setStyleProperties?(s: Record<string, string>): void };
      }
    ).current?.setStyleProperties?.({
      transform: `translateX(${offset}px)`,
    });
  }

  return {
    containerRef,
    updateSwiperStyle,
  };
}
