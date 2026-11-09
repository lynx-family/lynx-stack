// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { bindPage } from '@lynx-js/lynx-runtime/bts';

interface Data {
  count?: number;
}

interface BackgroundEntry {
  readLater(read: () => Promise<string>): Promise<void>;
  dispose(): void;
}

/** Install during BTS bootstrap; the callbacks belong to this entry instance. */
export function startBackground(
  showData: (data: Readonly<Data>) => void,
  showResult: (value: string) => void,
): BackgroundEntry {
  const page = bindPage();
  let active = true;
  let data = page.getInitData<Data>();
  const stops = [
    page.onUpdateData<Data>((patch, options) => {
      data = options.resetPageData ? { ...patch } : { ...data, ...patch };
      showData(data);
    }),
    page.onReload(() => {
      data = page.getInitData<Data>();
      showData(data);
    }),
  ];
  const stopDestroy = page.onDestroy(dispose);
  showData(data);

  function dispose(): void {
    active = false;
    for (const stop of stops) stop();
    stopDestroy();
  }

  return {
    async readLater(read): Promise<void> {
      if (!active || page.isDestroyed()) return;
      const value = await read();
      // A live page may contain a replacement entry. Check both lifetimes.
      if (!active || page.isDestroyed()) return;
      showResult(value);
    },
    dispose,
  };
}
