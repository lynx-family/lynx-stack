// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import '../hooks/react.js';
import { callDestroyLifetimeFun } from './callDestroyLifetimeFun.js';
import { injectCalledByNative } from './main-thread-api.js';
import { installOnMtsDestruction } from './mts-destroy.js';
import { installElementTemplatePatchListener } from './patch-listener.js';
import { installMainThreadHooks } from '../../core/hooks/mainThreadImpl.js';
import { installElementTemplateCommitHook } from '../background/commit-hook.js';
import { setupBackgroundElementTemplateDocument } from '../background/document.js';
import { installElementTemplateHydrationListener } from '../background/hydration-listener.js';
import { BackgroundElementTemplateInstance } from '../background/instance.js';
import { initProfileHook } from '../debug/profile.js';
import { setupLynxEnv } from '../lynx/env.js';
import { initTimingAPI } from '../lynx/performance.js';
import { setRoot } from '../runtime/page/root-instance.js';

function init(): void {
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
    lynxCoreInject.tt.callDestroyLifetimeFun = callDestroyLifetimeFun;
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
