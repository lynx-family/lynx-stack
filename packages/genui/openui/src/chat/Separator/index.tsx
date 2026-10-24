// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Separator as definition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import '../../../styles/catalog/ChatSeparator.css';

/** Chat divider, horizontal and decorative unless specified otherwise. */
export const Separator: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ({ props }) => (
    <view
      className={`OpenUIChatSeparator OpenUIChatSeparator-${
        props.orientation ?? 'horizontal'
      }`}
      accessibility-element={props.decorative === false}
      {...(props.decorative === false
        ? { 'accessibility-role-description': 'separator' }
        : {})}
    />
  ),
};
