// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { TextContent as TextContentDefinition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';

import '../../../styles/catalog/TextContent.css';

export const TextContent: DefinedComponent<typeof TextContentDefinition.props> =
  {
    ...TextContentDefinition,
    component: ({ props }) => {
      const size = props.size ?? 'default';
      let sizeClass = 'OpenUITextContentDefault';
      if (size === 'small') {
        sizeClass = 'OpenUITextContentSmall';
      } else if (size === 'large') {
        sizeClass = 'OpenUITextContentLarge';
      } else if (size === 'small-heavy') {
        sizeClass = 'OpenUITextContentSmallHeavy';
      } else if (size === 'large-heavy') {
        sizeClass = 'OpenUITextContentLargeHeavy';
      }

      return (
        <text className={`OpenUITextContent ${sizeClass}`}>
          {String(props.text ?? '')}
        </text>
      );
    },
  };
