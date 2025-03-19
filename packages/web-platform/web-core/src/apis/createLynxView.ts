// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  Cloneable,
  NapiModulesMap,
  NativeModulesMap,
  UpdateDataType,
} from '@lynx-js/web-constants';
import { startUIThread } from '../uiThread/startUIThread.js';

export interface LynxViewConfigs {
  templateUrl: string;
  initData: Cloneable;
  globalProps: Cloneable;
  rootDom: HTMLElement;
  callbacks: Parameters<typeof startUIThread>[3];
  overrideLynxTagToHTMLTagMap?: Record<string, string>;
  nativeModulesMap: NativeModulesMap;
  napiModulesMap: NapiModulesMap;
  tagMap: Record<string, string>;
}

export interface LynxView {
  updateData(
    data: Cloneable,
    updateDataType: UpdateDataType,
    callback?: () => void,
  ): void;
  dispose(): Promise<void>;
  sendGlobalEvent(name: string, params?: Cloneable[]): void;
}

export function createLynxView(configs: LynxViewConfigs): LynxView {
  const {
    rootDom,
    callbacks,
    templateUrl,
    globalProps,
    initData,
    overrideLynxTagToHTMLTagMap,
    nativeModulesMap,
    napiModulesMap,
    tagMap,
  } = configs;
  return startUIThread(
    templateUrl,
    {
      tagMap,
      initData,
      globalProps,
      nativeModulesMap,
      napiModulesMap,
      browserConfig: {},
    },
    rootDom,
    callbacks,
    overrideLynxTagToHTMLTagMap,
  );
}
