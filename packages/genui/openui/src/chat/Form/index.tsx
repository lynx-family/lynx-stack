// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Form as definition } from './definition.js';
import { FormNameContext } from '../../core/context.jsx';
import {
  FormValidationContext,
  useCreateFormValidation,
} from '../../core/hooks/useFormValidation.js';
import type { DefinedComponent } from '../../core/library.jsx';
import '../../../styles/catalog/ChatForm.css';

/** Named Chat form with isolated validation and host action payloads. */
export const Form: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ({ props, renderNode }) => {
    const validation = useCreateFormValidation();
    return (
      <FormValidationContext.Provider value={validation}>
        <FormNameContext.Provider value={props.name}>
          <view className='OpenUIChatForm'>
            {renderNode(props.fields ?? [])}
            {renderNode(props.buttons)}
          </view>
        </FormNameContext.Provider>
      </FormValidationContext.Provider>
    );
  },
};
