// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import '@lynx-js/react';
import type { ComponentAtIndexCallback } from '@lynx-js/type-element-api';

import { PREFIX, hook } from './hook.js';

if (typeof Codspeed !== 'undefined' && __MAIN_THREAD__) {
  function withCodspeed(
    componentAtIndex: ComponentAtIndexCallback,
  ): ComponentAtIndexCallback {
    return (
      list,
      listID,
      cellIndex,
      operationID,
      enableReuseNotification,
    ) => {
      const ids = __GetChildren(list).map(e => __GetElementUniqueID(e));
      Codspeed.startBenchmark();
      const sign = componentAtIndex(
        list,
        listID,
        cellIndex,
        operationID,
        enableReuseNotification,
      )!;
      Codspeed.stopBenchmark();
      Codspeed.setExecutedBenchmark(
        `${PREFIX}::${__webpack_chunkname__}-componentAtIndex__${
          ids.includes(sign) ? 'reuse' : 'create'
        } `,
      );

      return sign;
    };
  }

  hook(
    globalThis,
    '__UpdateListCallbacks',
    (
      old,
      list,
      componentAtIndex,
      enqueueComponent,
      componentAtIndexes,
    ) => {
      old!(
        list,
        withCodspeed(componentAtIndex),
        enqueueComponent,
        componentAtIndexes,
      );
    },
  );

  hook(
    globalThis,
    '__CreateList',
    (
      old,
      id,
      componentAtIndex,
      enqueueComponent,
      info,
      componentAtIndexes,
    ) => {
      return old!(
        id,
        withCodspeed(componentAtIndex),
        enqueueComponent,
        info,
        componentAtIndexes,
      );
    },
  );
}
