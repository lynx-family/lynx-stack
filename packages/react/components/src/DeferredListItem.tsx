// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { FC, ReactNode, RefCallback } from 'react';

import { cloneElement as _cloneElement, useCallback, useRef, useState } from '@lynx-js/react';
import type { SnapshotInstance } from '@lynx-js/react/internal';
import { cloneElement as _cloneElementMainThread } from '@lynx-js/react/lepus';

export interface DeferredListItemProps {
  defer?: boolean | { unmountRecycled?: boolean };
  renderListItem: (children: ReactNode | undefined) => JSX.Element;
  renderChildren: () => ReactNode;
}

export const DeferredListItem: FC<DeferredListItemProps> = ({ defer, renderListItem, renderChildren }) => {
  const __cloneElement = __MAIN_THREAD__ ? _cloneElementMainThread : _cloneElement;

  const initialDeferRef = useRef(defer);
  const prevDeferRef = useRef(defer);
  const [isReady, setIsReady] = useState(!defer);
  const onGetSnapshotInstance = useCallback<RefCallback<SnapshotInstance>>((ctx) => {
    'background only';

    ctx!.__extraProps ??= {};

    // hack: preact ignore function property on dom
    ctx!.__extraProps['onComponentAtIndex'] = () => {
      setIsReady(true);
    };
    ctx!.__extraProps['onRecycleComponent'] = () => {
      if (defer && typeof defer === 'object' && defer.unmountRecycled) {
        // unmount the component when recycled
        setIsReady(false);
      }
    };

    return () => {
      delete ctx!.__extraProps!['onComponentAtIndex'];
      delete ctx!.__extraProps!['onRecycleComponent'];
    };
  }, []);

  if (__BACKGROUND__) {
    if (prevDeferRef.current && !defer) {
      setIsReady(true);
    }
    prevDeferRef.current = defer;
  }

  return initialDeferRef.current
    ? __cloneElement(renderListItem(isReady ? renderChildren() : null), {
      isReady: +isReady, // hack: preact specially handled boolean props
      ref: onGetSnapshotInstance,
    })
    : renderListItem(renderChildren());
};
