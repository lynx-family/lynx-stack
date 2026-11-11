// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Text as TextDefinition, textVariants } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import { stringifyValue } from '../utils.js';

import '../../../styles/catalog/Text.css';

function getVariantClass(variant: typeof textVariants[number]): string {
  switch (variant) {
    case 'h1':
      return 'OpenUITextH1';
    case 'h2':
      return 'OpenUITextH2';
    case 'h3':
      return 'OpenUITextH3';
    case 'h4':
      return 'OpenUITextH4';
    case 'h5':
      return 'OpenUITextH5';
    case 'caption':
      return 'OpenUITextCaption';
    default:
      return 'OpenUITextBody';
  }
}

export const Text: DefinedComponent<typeof TextDefinition.props> = {
  ...TextDefinition,
  component: ({ props }) => {
    const variant = props.variant ?? 'body';
    return (
      <text className={`OpenUIText ${getVariantClass(variant)}`}>
        {stringifyValue(props.text)}
      </text>
    );
  },
};
