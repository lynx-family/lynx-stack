// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const cssIdAttribute = 'l-css-id' as const;

export const componentIdAttribute = 'l-comp-id' as const;

export const parentComponentUniqueIdAttribute = 'l-p-comp-uid' as const;

export const lynxEntryNameAttribute = 'l-e-name' as const;

export const lynxTagAttribute = 'lynx-tag' as const;

export const lynxDatasetAttribute = 'l-dset' as const;

export const lynxComponentConfigAttribute = 'l-comp-cfg' as const;

export const lynxDisposedAttribute = 'l-disposed' as const;

export const lynxElementTemplateMarkerAttribute = 'l-template' as const;

export const lynxPartIdAttribute = 'dirtyID' as const;

export const lynxDefaultDisplayLinearAttribute =
  'lynx-default-display-linear' as const;

export const lynxDefaultOverflowVisibleAttribute =
  'lynx-default-overflow-visible' as const;

export const __lynx_timing_flag = '__lynx_timing_flag' as const;

export const uniqueIdSymbol = Symbol('uniqueId');

export const systemInfo = {
  platform: 'web',
  lynxSdkVersion: '3.0',
} as Record<string, string | number>;

export const inShadowRootStyles: string[] = [
  ` [lynx-default-display-linear="false"] * {
    --lynx-display: flex;
    --lynx-display-toggle: var(--lynx-display-flex);
  }`,
  `[lynx-default-overflow-visible="true"] x-view{
    overflow: visible;
  }`,
];

export const W3cEventNameToLynx: Record<string, string> = {
  click: 'tap',
  lynxscroll: 'scroll',
  lynxscrollend: 'scrollend',
  overlaytouch: 'touch',
  lynxfocus: 'focus',
  lynxblur: 'blur',
  lynxinput: 'input',
};

export const LynxEventNameToW3cCommon: Record<string, string> = {
  tap: 'click',
  scroll: 'lynxscroll',
  scrollend: 'lynxscrollend',
  touch: 'overlaytouch',
  'lynxblur': 'lynxblur',
  'lynxfocus': 'lynxfocus',
  'lynxinput': 'lynxinput',
};

// YnYRNREG
export const MagicHeader = 0x596E59524E526567; // random magic number for verififying the stream is a Lynx encoded template

export const TemplateSectionLabel = {
  Manifest: 1,
  StyleInfo: 2,
  LepusCode: 3,
  CustomSections: 4,
  ElementTemplates: 5,
  Configurations: 6,
} as const;

/**
 * const enum will be shakedown in Typescript Compiler
 */
export const enum ErrorCode {
  SUCCESS = 0,
  UNKNOWN = 1,
  NODE_NOT_FOUND = 2,
  METHOD_NOT_FOUND = 3,
  PARAM_INVALID = 4,
  SELECTOR_NOT_SUPPORTED = 5,
  NO_UI_FOR_NODE = 6,
}

export const defaultTagMap = {
  'input': 'x-input',
  'x-input-ng': 'x-input',
};
