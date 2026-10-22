// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { z } from 'zod/v4';

import {
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogRoot,
  DialogTrigger,
  DialogView,
} from '@lynx-js/lynx-ui';
import { useMemo, useState } from '@lynx-js/react';
import type { ReactNode } from '@lynx-js/react';

import { Modal as ModalDefinition } from './definition.js';
import {
  OpenUIContext,
  useIsStreaming,
  useOpenUI,
} from '../../core/context.jsx';
import type { DefinedComponent } from '../../core/library.jsx';
import { stringifyValue } from '../utils.js';

import '../../../styles/catalog/Modal.css';

type ModalProps = z.infer<typeof ModalDefinition.props>;

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
    <DialogRoot show={open} onShowChange={setOpen}>
      <view className='OpenUIModal'>
        <OpenUIContext.Provider value={triggerContext}>
          <DialogTrigger
            className='OpenUIModalTrigger'
            disabled={isStreaming}
          >
            {renderNode(props.trigger)}
          </DialogTrigger>
        </OpenUIContext.Provider>
      </view>
      <DialogView
        className='OpenUIModalView'
        overlayLevel={4}
      >
        <DialogBackdrop
          className='OpenUIModalMask'
          clickToClose={!isStreaming}
          transition={true}
        />
        <DialogContent
          className='OpenUIModalContent'
          transition={true}
        >
          <view className='OpenUIModalHeader'>
            {props.title
              ? (
                <text className='OpenUIModalTitle'>
                  {stringifyValue(props.title)}
                </text>
              )
              : null}
            <DialogClose
              className='OpenUIModalClose'
              disabled={isStreaming}
            >
              <text className='OpenUIModalCloseText'>x</text>
            </DialogClose>
          </view>
          <OpenUIContext.Provider value={contentContext}>
            <scroll-view
              className='OpenUIModalBody'
              scroll-orientation='vertical'
              enable-nested-scroll={true}
            >
              {renderNode(props.content)}
            </scroll-view>
          </OpenUIContext.Provider>
        </DialogContent>
      </DialogView>
    </DialogRoot>
  );
}

export const Modal: DefinedComponent<typeof ModalDefinition.props> = {
  ...ModalDefinition,
  component: ModalRenderer,
};
