// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  DialogBackdrop,
  DialogContent,
  DialogRoot,
  DialogView,
} from '@lynx-js/lynx-ui';
import { useState } from '@lynx-js/react';

import { NodeRenderer } from '../../react/A2UIRenderer.jsx';
import type {
  ComponentInstance,
  GenericComponentProps,
} from '../../store/types.js';

import '../../../styles/catalog/Modal.css';

/**
 * @a2uiCatalog Modal
 */
export interface ModalProps extends GenericComponentProps {
  /** The ID of the component that opens the modal when interacted with. */
  trigger: string;
  /** The ID of the component to display inside the modal. */
  content: string;
}

function childWithContext(
  child: ComponentInstance | undefined,
  dataContextPath: string | undefined,
): ComponentInstance | undefined {
  return child && dataContextPath
    ? { ...child, dataContextPath }
    : child;
}

export function Modal(
  props: ModalProps,
): import('@lynx-js/react').ReactNode {
  const {
    dataContextPath,
    surface,
  } = props;
  const [open, setOpen] = useState(false);

  const compatibleProps = props as ModalProps & {
    contentChild?: string;
    entryPointChild?: string;
  };
  const triggerId = compatibleProps.trigger ?? compatibleProps.entryPointChild;
  const contentId = compatibleProps.content ?? compatibleProps.contentChild;

  const trigger = childWithContext(
    triggerId ? surface.components.get(triggerId) : undefined,
    dataContextPath,
  );
  const content = childWithContext(
    contentId ? surface.components.get(contentId) : undefined,
    dataContextPath,
  );

  const handleOpen = () => {
    setOpen(true);
  };

  return (
    <DialogRoot
      show={open}
      onShowChange={(nextOpen) => {
        setOpen(nextOpen);
      }}
    >
      <view className='modal-trigger' bindtap={handleOpen}>
        {trigger
          ? (
            <NodeRenderer
              component={trigger}
              surface={surface}
              suppressActionDispatch={true}
            />
          )
          : null}
      </view>
      <DialogView className='modal-view' overlayLevel={4}>
        <DialogBackdrop
          className='modal-backdrop'
          clickToClose={true}
          transition={true}
        />
        <DialogContent className='modal-content' transition={true}>
          {content
            ? <NodeRenderer component={content} surface={surface} />
            : null}
        </DialogContent>
      </DialogView>
    </DialogRoot>
  );
}
