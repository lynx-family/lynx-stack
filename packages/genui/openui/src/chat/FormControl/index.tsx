// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { FormControl as definition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import '../../../styles/catalog/ChatFormControl.css';

/** Chat form label, control and hint. */
export const FormControl: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ({ props, renderNode }) => (
    <view className='OpenUIChatFormControl'>
      <text className='OpenUIChatFormLabel'>{props.label ?? ''}</text>
      {renderNode(props.input)}
      {props.hint && <text className='OpenUIChatFormHint'>{props.hint}</text>}
    </view>
  ),
};
