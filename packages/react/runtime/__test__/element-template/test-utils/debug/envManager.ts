// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { flushCoreContextEvents, flushJSContextEvents } from '../mock/mockNativePapi/context.js';
import { installMainThreadHooks } from '../../../../src/core/hooks/mainThreadImpl.js';
import { setupBackgroundElementTemplateDocument } from '../../../../src/element-template/background/document.js';
import { BackgroundElementTemplateInstance } from '../../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../../src/element-template/background/manager.js';
import { __root, setRoot } from '../../../../src/element-template/runtime/page/root-instance.js';
import { resetTemplateId } from '../../../../src/element-template/runtime/template/handle.js';
import { ElementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';

type RootRef = typeof __root;

type EnvTarget = typeof globalThis & {
  __LEPUS__: boolean | undefined;
  __JS__: boolean | undefined;
  __MAIN_THREAD__: boolean | undefined;
  __BACKGROUND__: boolean | undefined;
  __USE_ELEMENT_TEMPLATE__: boolean | undefined;
};

type RootWithTemplates = RootRef & {
  __jsx?: unknown;
  __opcodes?: unknown;
};

export class ElementTemplateEnvManager {
  private mainRoot: RootRef | undefined;
  private backgroundRoot: BackgroundElementTemplateInstance | undefined;

  constructor(private target: EnvTarget = globalThis as unknown as EnvTarget) {}

  switchToMainThread(fn?: () => void): void {
    if (this.target.__BACKGROUND__) {
      this.backgroundRoot = __root as BackgroundElementTemplateInstance;
    }

    this.mainRoot ??= {};

    setRoot(this.mainRoot);
    this.target.__LEPUS__ = true;
    this.target.__JS__ = false;
    this.target.__MAIN_THREAD__ = true;
    this.target.__BACKGROUND__ = false;
    installMainThreadHooks();

    fn?.();

    flushJSContextEvents();
  }

  switchToBackground(fn?: () => void): void {
    if (this.target.__MAIN_THREAD__) {
      this.mainRoot = __root;
    }

    if (!(this.backgroundRoot instanceof BackgroundElementTemplateInstance)) {
      this.backgroundRoot = new BackgroundElementTemplateInstance('root');
    }

    setRoot(this.backgroundRoot);
    this.target.__LEPUS__ = false;
    this.target.__JS__ = true;
    this.target.__MAIN_THREAD__ = false;
    this.target.__BACKGROUND__ = true;
    setupBackgroundElementTemplateDocument();

    fn?.();

    flushCoreContextEvents();
  }

  resetEnv(initial: 'background' | 'main' = 'background'): void {
    this.mainRoot = undefined;
    this.backgroundRoot = undefined;
    // @ts-expect-error - allow reset to undefined during tests
    setRoot(undefined);

    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;
    ElementTemplateRegistry.clear();
    resetTemplateId();

    if (initial === 'background') {
      this.switchToBackground();
    } else {
      this.switchToMainThread();
    }
  }

  setUseElementTemplate(enabled: boolean): void {
    this.target.__USE_ELEMENT_TEMPLATE__ = enabled;
  }
}
