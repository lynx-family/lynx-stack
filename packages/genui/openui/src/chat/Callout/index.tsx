// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { isReactiveAssign } from '@openuidev/lang-core';

import { useEffect, useRef } from '@lynx-js/react';

import { Callout as definition } from './definition.js';
import { useOpenUI } from '../../core/context.jsx';
import { useStateField } from '../../core/hooks/useStateField.js';
import type { DefinedComponent } from '../../core/library.jsx';
import { Markdown } from '../markdown.jsx';
import '../../../styles/catalog/ChatCallout.css';

/** Chat banner with Markdown and an optional three-second reactive dismissal. */
export const Callout: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ({ props }) => {
    const field = useStateField('visible', props.visible);
    const { evaluationContext } = useOpenUI();
    const target = isReactiveAssign(props.visible)
      ? props.visible.target
      : undefined;
    const value = field.value ?? (target
      ? evaluationContext?.getState(target)
      : undefined);
    const visible = !field.isReactive || value === true;
    const setVisible = useRef(field.setValue);
    setVisible.current = field.setValue;
    useEffect(() => {
      if (!target || !visible) return;
      const timer = setTimeout(() => setVisible.current(false), 3000);
      return () => clearTimeout(timer);
    }, [target, visible]);
    if (!visible) return null;
    return (
      <view
        className={`OpenUIChatCallout OpenUIChatCallout-${
          props.variant ?? 'info'
        }`}
      >
        {props.title && (
          <text className='OpenUIChatCalloutTitle'>{props.title}</text>
        )}
        {props.description && <Markdown text={props.description} />}
      </view>
    );
  },
};
