// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import '@lynx-js/react/hooks';
import type { ComponentChild, ContainerNode, VNode } from 'preact';
import { render } from 'preact';

import { callDestroyLifetimeFun } from './callDestroyLifetimeFun.js';
import { injectCalledByNative } from './main-thread-api.js';
import { installOnMtsDestruction } from './mts-destroy.js';
import { installElementTemplatePatchListener } from './patch-listener.js';
import { reloadBackground } from './reload-background.js';
import { runWithForceRootRender } from '../../core/forceRootRender.js';
import { updateGlobalProps as updateGlobalPropsCore } from '../../core/globalProps.js';
import { installMainThreadHooks } from '../../core/hooks/mainThreadImpl.js';
import { updateCardData } from '../../core/lynx-update-data.js';
import { installElementTemplateCommitHook } from '../background/commit-hook.js';
import { setupBackgroundElementTemplateDocument } from '../background/document.js';
import { installElementTemplateHydrationListener } from '../background/hydration-listener.js';
import { BackgroundElementTemplateInstance } from '../background/instance.js';
import { initElementTemplatePAPICallAlog } from '../debug/elementPAPICall.js';
import { initProfileHook } from '../debug/profile.js';
import { setupLynxEnv } from '../lynx/env.js';
import { initTimingAPI } from '../lynx/performance.js';
import { publicComponentEvent, publishEvent, resetEventStateForRuntime } from '../prop-adapters/event.js';
import { __root, setRoot } from '../runtime/page/root-instance.js';

function forceRootRender(): void {
  runWithForceRootRender({
    getRootVNode: () => __root.__jsx,
    setRootVNode: (vnode: VNode) => {
      // @ts-expect-error: __root.__jsx is a Preact VNode during background force render.
      __root.__jsx = vnode;
    },
    render: () => {
      render(__root.__jsx as ComponentChild, __root as unknown as ContainerNode);
    },
  });
}

const updateGlobalPropsOptions = {
  forceRerender: forceRootRender,
};

function updateGlobalProps(newData: Record<string, any>): void {
  updateGlobalPropsCore(newData, updateGlobalPropsOptions);
}

function init(): void {
  if (typeof __ALOG_ELEMENT_API__ !== 'undefined' && __ALOG_ELEMENT_API__) {
    initElementTemplatePAPICallAlog();
  }

  if (__MAIN_THREAD__) {
    installMainThreadHooks();
    injectCalledByNative();
    installElementTemplatePatchListener();
    installOnMtsDestruction();
    if (__PROFILE__) {
      initProfileHook();
    }
  }

  if (__BACKGROUND__) {
    console.log('experimental_useElementTemplate:', __USE_ELEMENT_TEMPLATE__);
    setRoot(new BackgroundElementTemplateInstance('root'));
    setupBackgroundElementTemplateDocument();
    installElementTemplateHydrationListener();
    resetEventStateForRuntime();
    lynxCoreInject.tt.callDestroyLifetimeFun = callDestroyLifetimeFun;
    lynxCoreInject.tt.publishEvent = publishEvent;
    lynxCoreInject.tt.publicComponentEvent = publicComponentEvent;
    lynxCoreInject.tt.updateGlobalProps = updateGlobalProps;
    lynxCoreInject.tt.updateCardData = updateCardData;
    lynxCoreInject.tt.onAppReload = reloadBackground;
    installElementTemplateCommitHook();
    if (process.env['NODE_ENV'] !== 'test') {
      initTimingAPI();
      if (lynx.performance?.isProfileRecording?.()) {
        initProfileHook();
      }
    }
  }

  setupLynxEnv();
}

init();
