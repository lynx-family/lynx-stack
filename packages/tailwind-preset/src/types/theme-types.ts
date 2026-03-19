// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  KeyValuePair,
  ResolvableTo,
  ThemeConfig,
} from './tailwind-types.js';

type LynxThemeOverrides = Pick<
  ThemeConfig,
  | 'aspectRatio'
  | 'boxShadow'
  | 'grayscale'
  | 'gridAutoColumns'
  | 'gridAutoRows'
  | 'gridTemplateColumns'
  | 'gridTemplateRows'
  | 'transitionProperty'
  | 'transitionDuration'
  | 'transitionTimingFunction'
  | 'zIndex'
>;

type LynxThemeExtension = LynxTailwindEarlyAdoption & LynxCustomFields;

interface LynxTailwindEarlyAdoption {
  perspective: ResolvableTo<KeyValuePair>;
}

interface LynxCustomFields {}

type LynxThemeConfig =
  & Omit<ThemeConfig, keyof LynxThemeOverrides>
  & LynxThemeOverrides
  & LynxThemeExtension;

export type {
  LynxThemeConfig,
  LynxThemeOverrides,
  LynxThemeExtension,
  LynxTailwindEarlyAdoption,
};
