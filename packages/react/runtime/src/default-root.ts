// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ReactNode } from 'react';

import type { DataProcessorDefinition } from './core/lynx-data-processors.js';
import { getPageLynx, hasPageLynx } from './core/page-lynx.js';
import type { Root } from './lynx-api.js';
import { __root, transferMode, warnRootRenderOnTransferPage } from './root.js';
import { renderBackground } from './snapshot/lynx/appCallbacks.js';

/**
 * The default and only root of ReactLynx for you to render JSX
 * @example
 * ```ts
 * import { root } from "@lynx-js/react"
 * ```
 *
 * @public
 *
 * @group Functions
 */
export const root: Root = {
  render: (jsx: ReactNode): void => {
    // Transfer pages render only registered components; the page root stays empty.
    if (transferMode) {
      warnRootRenderOnTransferPage();
      return;
    }
    /* v8 ignore next 2 */
    if (typeof __MAIN_THREAD__ !== 'undefined' && __MAIN_THREAD__) {
      __root.__jsx = jsx;
    } else {
      if (
        typeof __LYNX_GROUP_MODULE_SHARING__ !== 'undefined'
        && __LYNX_GROUP_MODULE_SHARING__ && !hasPageLynx()
      ) {
        throw new Error('experimental_lynxGroupModuleSharing requires rendering through createRoot(lynx).');
      }
      renderBackground(jsx);
    }
  },
  /* v8 ignore next 3 */
  registerDataProcessors: (dataProcessorDefinition: DataProcessorDefinition): void => {
    getPageLynx().registerDataProcessors(dataProcessorDefinition);
  },
};
