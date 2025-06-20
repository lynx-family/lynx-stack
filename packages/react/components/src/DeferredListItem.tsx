// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { FC, ReactNode, RefCallback } from 'react';

import { cloneElement as _cloneElement, useRef, useState } from '@lynx-js/react';
import type { SnapshotInstance } from '@lynx-js/react/internal';
import { cloneElement as _cloneElementLepus } from '@lynx-js/react/lepus';

export interface DeferredListItem {
  defer?: boolean;
  renderListItem: (children: ReactNode | undefined) => JSX.Element;
  renderChildren: () => ReactNode;
}

export const DeferredListItem: FC<DeferredListItem> = ({ defer, renderListItem, renderChildren }) => {
  const __cloneElement = __LEPUS__ ? _cloneElementLepus : _cloneElement;

  const initialDeferred = useRef(defer);
  const onGetDomRef = useRef<RefCallback<SnapshotInstance>>((ctx) => {
    ctx!.__extraProps ??= {};

    // hack: preact ignore function property on dom
    ctx!.__extraProps['onComponentAtIndex'] = () => {
      setIsReady(true);
    };
    ctx!.__extraProps['onEnqueueComponent'] = () => {
      setIsReady(false);
    };

    return () => {
      delete ctx!.__extraProps!['onComponentAtIndex'];
      delete ctx!.__extraProps!['onEnqueueComponent'];
    };
  });
  const [isReady, setIsReady] = useState(!defer);

  return initialDeferred.current
    ? __cloneElement(renderListItem(isReady ? renderChildren() : null), {
      isReady: +isReady,
      ref: onGetDomRef.current,
    })
    : renderListItem(renderChildren());
};
