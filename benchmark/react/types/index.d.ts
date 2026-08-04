// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { IntrinsicElements as LynxIntrinsicElements } from '@lynx-js/types';

type LynxTextProps = LynxIntrinsicElements['text'];

interface TransformedTextProps {
  /** React-style alias of `text-maxline`. */
  textMaxline?: LynxTextProps['text-maxline'];
  /** React-style alias of `text-maxlength`. */
  textMaxlength?: LynxTextProps['text-maxlength'];
  /** React-style alias of `enable-font-scaling`. */
  enableFontScaling?: LynxTextProps['enable-font-scaling'];
  /** React-style alias of `text-vertical-align`. */
  textVerticalAlign?: LynxTextProps['text-vertical-align'];
  /** React-style alias of `tail-color-convert`. */
  tailColorConvert?: LynxTextProps['tail-color-convert'];
  /** React-style alias of `include-font-padding`. */
  includeFontPadding?: LynxTextProps['include-font-padding'];
  /** React-style alias of `text-fake-bold`. */
  textFakeBold?: LynxTextProps['text-fake-bold'];
  /** React-style alias of `text-selection`. */
  textSelection?: LynxTextProps['text-selection'];
  /** React-style alias of `bindtap`. */
  onClick?: LynxTextProps['bindtap'];
}

declare module '@lynx-js/react/jsx-runtime' {
  export namespace JSX {
    interface IntrinsicElements {
      text: LynxTextProps & TransformedTextProps;
    }
  }
}

export {};
