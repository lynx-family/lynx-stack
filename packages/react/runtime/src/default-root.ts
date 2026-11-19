// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { render } from 'preact';
import type { ReactNode } from 'react';

import type { DataProcessorDefinition } from './core/lynx-data-processors.js';
import { getPageLynx, hasPageLynx } from './core/page-lynx.js';
import type { Root } from './lynx-api.js';
import { __root, transferMode, warnRootRenderOnTransferPage } from './root.js';
import { profileEnd, profileStart } from './shared/profile.js';
import { LifecycleConstant } from './snapshot/lifecycle/constant.js';
import { flushDelayedLifecycleEvents } from './snapshot/lynx/appCallbacks.js';

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
      __root.__jsx = jsx;
      if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
        profileStart('ReactLynx::renderBackground');
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      render(jsx, __root as any);
      if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
        profileEnd();
      }
      if (__FIRST_SCREEN_SYNC_TIMING__ === 'jsReady') {
        // `jsReady` is a special case of the `manual` first-screen sync: the
        // framework marks ready automatically once the background is ready.
        getPageLynx().getNativeApp().callLepusMethod(LifecycleConstant.firstScreenSyncReady, {});
      } else {
        // `immediately` or `manual`: the first screen is synced without waiting
        // for the background, so the `firstScreen` message might have been
        // reached when `root.render()` is called asynchronously.
        flushDelayedLifecycleEvents();
      }
    }
  },
  /* v8 ignore next 3 */
  registerDataProcessors: (dataProcessorDefinition: DataProcessorDefinition): void => {
    getPageLynx().registerDataProcessors(dataProcessorDefinition);
  },
};
