// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

declare module 'tailwindcss/lib/util/createUtilityPlugin.js' {
  import type { PluginCreator } from 'tailwindcss/types/config';

  import type { UtilityPluginOptions, UtilityVariations } from './types.js';

  const createUtilityPlugin: (
    themeKey: string,
    utilityVariations?: UtilityVariations,
    options?: UtilityPluginOptions,
  ) => PluginCreator;

  export default createUtilityPlugin;
}

declare module 'tailwindcss/lib/util/transformThemeValue.js' {
  export type ValueTransformer<T = unknown> = (
    value: T,
    opts?: Record<string, unknown>,
  ) => string | number | string[] | undefined;

  export function transformThemeValue(
    themeSection: 'fontSize' | 'outline',
  ): (value: unknown) => string;
  export function transformThemeValue(
    themeSection: 'fontFamily',
  ): (value: unknown) => string;

  export function transformThemeValue(
    themeSection:
      | 'boxShadow'
      | 'transitionProperty'
      | 'transitionDuration'
      | 'transitionDelay'
      | 'transitionTimingFunction'
      | 'backgroundImage'
      | 'backgroundSize'
      | 'backgroundColor'
      | 'cursor'
      | 'animation',
  ): (value: unknown) => string;

  export function transformThemeValue(
    themeSection:
      | 'gridTemplateColumns'
      | 'gridTemplateRows'
      | 'objectPosition',
  ): (value: unknown) => string;
  export function transformThemeValue(themeSection: string): ValueTransformer;

  export default transformThemeValue;
}

declare module 'tailwindcss/lib/util/parseBoxShadowValue.js' {
  /** Parsed fragment of one shadow clause */
  export interface ShadowPart {
    raw: string;
    keyword?: string;
    x?: string;
    y?: string;
    blur?: string;
    spread?: string;
    color?: string;
    unknown?: string[];
    valid: boolean;
  }

  /**
   * Split a `box-shadow` string into structured fragments.
   * e.g. `0 1px 2px rgb(0 0 0 / 0.05)` → [{ x:'0', y:'1px', … }]
   */
  export function parseBoxShadowValue(input: string): ShadowPart[];

  /**
   * Re-assemble the structured fragments back into a valid CSS string
   */
  export function formatBoxShadowValue(shadows: ShadowPart[]): string;

  const defaultExport: {
    parseBoxShadowValue: typeof parseBoxShadowValue;
    formatBoxShadowValue: typeof formatBoxShadowValue;
  };

  export default defaultExport;
}
