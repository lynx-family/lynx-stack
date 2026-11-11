// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Image as ImageDefinition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import { stringifyValue } from '../utils.js';

import '../../../styles/catalog/Image.css';

export const Image: DefinedComponent<typeof ImageDefinition.props> = {
  ...ImageDefinition,
  component: ({ props }) => {
    const fit = props.fit ?? 'cover';
    const variant = props.variant ?? 'mediumFeature';
    const url = stringifyValue(props.url);

    const mode = (() => {
      switch (fit) {
        case 'contain':
        case 'scale-down':
          return 'aspectFit';
        case 'fill':
          return 'scaleToFill';
        case 'none':
          return 'center';
        default:
          return 'aspectFill';
      }
    })();

    return (
      <image
        auto-size
        src={url}
        mode={mode}
        className={`OpenUIImage OpenUIImageVariant${
          variant.charAt(0).toUpperCase() + variant.slice(1)
        }`}
      />
    );
  },
};
