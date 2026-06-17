// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { z } from 'zod/v4';

import { useMemo, useState } from '@lynx-js/react';
import type { ReactNode } from '@lynx-js/react';

import {
  OpenUIContext,
  useIsStreaming,
  useOpenUI,
} from '../../core/context.jsx';
import { defineComponent } from '../../core/library.jsx';
import { stringLikeSchema, stringifyValue } from '../utils.js';

const modalPropsSchema = z.object({
  trigger: z.any(),
  content: z.any(),
  title: stringLikeSchema.optional(),
  closeOnAction: z.boolean().optional(),
});

type ModalProps = z.infer<typeof modalPropsSchema>;

function ModalRenderer(
  { props, renderNode }: {
    props: ModalProps;
    renderNode: (v: unknown) => ReactNode;
  },
) {
  const [open, setOpen] = useState(false);
  const openUi = useOpenUI();
  const isStreaming = useIsStreaming();
  const closeOnAction = props.closeOnAction ?? true;
  const onOpen = () => setOpen(true);
  const onClose = () => setOpen(false);
  const triggerContext = useMemo(
    () => ({
      ...openUi,
      triggerAction: async (
        ...args: Parameters<typeof openUi.triggerAction>
      ) => {
        await openUi.triggerAction(...args);
        setOpen(true);
      },
    }),
    [openUi],
  );
  const contentContext = useMemo(
    () => ({
      ...openUi,
      triggerAction: async (
        ...args: Parameters<typeof openUi.triggerAction>
      ) => {
        await openUi.triggerAction(...args);
        if (closeOnAction) {
          setOpen(false);
        }
      },
    }),
    [openUi, closeOnAction],
  );

  return (
    <view className='OpenUIModal'>
      <OpenUIContext.Provider value={triggerContext}>
        <view
          className='OpenUIModalTrigger'
          {...(isStreaming ? {} : ({ bindtap: onOpen }))}
        >
          {renderNode(props.trigger)}
        </view>
      </OpenUIContext.Provider>
      {open
        ? (
          <view className='OpenUIModalMask'>
            <view className='OpenUIModalContent'>
              <view className='OpenUIModalHeader'>
                {props.title
                  ? (
                    <text className='OpenUIModalTitle'>
                      {stringifyValue(props.title)}
                    </text>
                  )
                  : null}
                <view
                  className='OpenUIModalClose'
                  {...(isStreaming ? {} : ({ bindtap: onClose }))}
                >
                  <text className='OpenUIModalCloseText'>x</text>
                </view>
              </view>
              <OpenUIContext.Provider value={contentContext}>
                <view className='OpenUIModalBody'>
                  {renderNode(props.content)}
                </view>
              </OpenUIContext.Provider>
            </view>
          </view>
        )
        : null}
    </view>
  );
}

export const Modal = defineComponent({
  name: 'Modal',
  props: modalPropsSchema,
  description: 'Tap-triggered modal container with custom content.',
  component: ModalRenderer,
});
