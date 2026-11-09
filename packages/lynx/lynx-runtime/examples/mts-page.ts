// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Unsubscribe } from '@lynx-js/lynx-runtime';
import {
  flushElementTree,
  getGlobalProps,
  getInitData,
  onDestroy,
  onGlobalPropsChanged,
  onReload,
  onRenderPage,
  onUpdateData,
} from '@lynx-js/lynx-runtime/mts';

interface Data {
  count?: number;
}

interface GlobalProps {
  accent?: string;
}

/** Install before the first host input; render updates the DSL's element tree synchronously. */
export function startMainThread(
  render: (data: Readonly<Data>, props: Readonly<GlobalProps>) => void,
): Unsubscribe {
  let data: Data = {};
  let props = getGlobalProps<GlobalProps>();
  const stops = [
    onRenderPage<Data>(() => {
      data = getInitData<Data>();
      render(data, props);
      // The host submits the first screen after this callback returns.
    }),
    onUpdateData<Data>((patch, options) => {
      data = options.resetPageData ? { ...patch } : { ...data, ...patch };
      render(data, props);
      // Keep the host's update context even if render made no changes.
      flushElementTree(options);
    }),
    onReload<Data>((_input, options) => {
      data = getInitData<Data>();
      render(data, props);
      flushElementTree(options);
    }),
    onGlobalPropsChanged<GlobalProps>((next, options) => {
      props = next;
      render(data, props);
      flushElementTree(options);
    }),
  ];
  const stopDestroy = onDestroy(dispose);

  function dispose(): void {
    for (const stop of stops) stop();
    stopDestroy();
  }

  return dispose;
}
