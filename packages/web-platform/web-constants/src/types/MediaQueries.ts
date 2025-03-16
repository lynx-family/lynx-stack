// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface MediaQueryConfig {
  query: string;
  styles: StyleEntry[];
}

export type StyleEntry = [property: string, value: string];

export interface ResponsiveStyle {
  base: StyleEntry[];
  mediaQueries: MediaQueryConfig[];
}

export const defaultBreakpoints = {
  mobile: '(max-width: 767px)',
  tablet: '(min-width: 768px) and (max-width: 1023px)',
  desktop: '(min-width: 1024px)',
} as const;

export type BreakpointKey = keyof typeof defaultBreakpoints;
