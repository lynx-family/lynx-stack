// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Buttons as definition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import '../../../styles/catalog/ChatButtons.css';

/** ReactLynx renderer for the OpenUI Chat Buttons contract. */
export const Buttons: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ({ props, renderNode }) => (
    <view
      className={`OpenUIChatButtons ${
        props.direction === 'column' ? 'OpenUIChatButtonsColumn' : ''
      }`}
    >
      {renderNode(props.buttons ?? [])}
    </view>
  ),
};
