// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ReactNode } from '@lynx-js/react';

import type { DefinedComponent } from '../../core/library.jsx';
import { asArray } from '../utils.js';
import { Buttons as ButtonsDefinition } from './definition.js';

import '../../../styles/catalog/Buttons.css';

function ButtonsRenderer(
  { props, renderNode }: {
    props: { buttons: unknown[] };
    renderNode: (v: unknown) => ReactNode;
  },
) {
  return (
    <view className='OpenUIButtonGroup'>
      {renderNode(asArray(props.buttons))}
    </view>
  );
}

export const Buttons: DefinedComponent<typeof ButtonsDefinition.props> = {
  ...ButtonsDefinition,
  component: ButtonsRenderer,
};
