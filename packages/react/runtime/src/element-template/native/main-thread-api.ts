// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  onGlobalPropsChanged,
  onReload,
  onRenderPage,
  onUpdateData,
  setPageDataGetter,
} from '@lynx-js/lynx-runtime/mts';
import type { MTSFlushContext, MTSReloadOptions, MTSUpdateOptions } from '@lynx-js/lynx-runtime/mts';

import { flushElementTemplate } from './flush.js';
import { reloadMainThread } from './reload-main-thread.js';
import { applyUpdatePageData } from '../../core/lynx-page-data.js';
import { registerDestroyTask } from '../../core/runtime-destroy.js';
import { createElementTemplatePage, setupPage } from '../runtime/page/page.js';
import { renderMainThread } from '../runtime/render/render-main-thread.js';

function injectCalledByNative(): void {
  const unsubRender = onRenderPage(renderPage);
  const unsubUpdate = onUpdateData(updatePage);
  const unsubReload = onReload(reloadPage);
  const unsubGlobalProps = onGlobalPropsChanged(updateGlobalProps);
  const unsubPageData = setPageDataGetter(() => null);
  registerDestroyTask(() => {
    unsubRender();
    unsubUpdate();
    unsubReload();
    unsubGlobalProps();
    unsubPageData();
  });
}

function renderPage(data: Readonly<Record<string, unknown>>): void {
  lynx.__initData = { ...data };
  setupPage(createElementTemplatePage());
  renderMainThread();
}

function updatePage(data: Readonly<Record<string, unknown>>, options: Readonly<MTSUpdateOptions>): void {
  if (__FIRST_SCREEN_SYNC_TIMING__ !== 'immediately') {
    return;
  }

  applyUpdatePageData(data, options);
  flushElementTemplate(options);
}

function reloadPage(data: Readonly<Record<string, unknown>>, options: Readonly<MTSReloadOptions>): void {
  if (__FIRST_SCREEN_SYNC_TIMING__ !== 'immediately') {
    return;
  }

  reloadMainThread(data, options);
}

function updateGlobalProps(_data: unknown, options?: Readonly<MTSFlushContext>): void {
  flushElementTemplate(options);
}

/**
 * @internal
 */
export { injectCalledByNative };
