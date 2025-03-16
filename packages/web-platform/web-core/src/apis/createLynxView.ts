// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  Cloneable,
  NapiModulesMap,
  UpdateDataType,
} from '@lynx-js/web-constants';
import { startUIThread } from '../uiThread/startUIThread.js';

export interface LynxViewConfigs {
  templateUrl: string;
  initData: Cloneable;
  globalProps: Cloneable;
  entryId: string;
  rootDom: HTMLElement;
  callbacks: Parameters<typeof startUIThread>[3];
  overrideLynxTagToHTMLTagMap?: Record<string, string>;
  nativeModulesUrl: string | undefined;
  napiModulesMap: NapiModulesMap;
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
    entryId,
    initData,
    overrideLynxTagToHTMLTagMap,
    nativeModulesUrl,
    napiModulesMap,
  } = configs;
  return startUIThread(
    templateUrl,
    {
      initData,
      globalProps,
      entryId,
      napiModulesMap,
      browserConfig: {},
    },
    rootDom,
    callbacks,
    overrideLynxTagToHTMLTagMap,
    nativeModulesUrl,
  );
}
