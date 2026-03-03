// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const lynxUniqueIdAttribute = /*#__PURE__*/ 'l-uid' as const;

export const cssIdAttribute = /*#__PURE__*/ 'l-css-id' as const;

export const lynxEntryNameAttribute = /*#__PURE__*/ 'l-e-name' as const;

export const lynxDisposedAttribute = /*#__PURE__*/ 'l-disposed' as const;

export const lynxElementTemplateMarkerAttribute =
  /*#__PURE__*/ 'l-template' as const;

export const lynxPartIdAttribute = /*#__PURE__*/ 'dirtyID' as const;

export const lynxDefaultDisplayLinearAttribute = /*#__PURE__*/
  'lynx-default-display-linear' as const;

export const lynxDefaultOverflowVisibleAttribute /*#__PURE__*/ =
  'lynx-default-overflow-visible' as const;

export const LYNX_TIMING_FLAG_ATTRIBUTE =
  /*#__PURE__*/ '__lynx_timing_flag' as const;

export const i18nResourceMissedEventName = 'i18nResourceMissed' as const;

export const uniqueIdSymbol = /*#__PURE__*/ Symbol('uniqueId');

export const systemInfoBase = /*#__PURE__*/ {
  platform: 'web',
  lynxSdkVersion: '3.0',
} as Record<string, string | number>;

export const W3cEventNameToLynx: Record<string, string> = /*#__PURE__*/ {
  click: 'tap',
  lynxscroll: 'scroll',
  lynxscrollend: 'scrollend',
  overlaytouch: 'touch',
  lynxfocus: 'focus',
  lynxblur: 'blur',
  lynxinput: 'input',
};

export const LynxEventNameToW3cCommon: Record<string, string> =
  /*#__PURE__*/ Object.fromEntries(
    Object.entries(W3cEventNameToLynx).map(([k, v]) => [v, k]),
  );

export const MagicHeader0 = /*#__PURE__*/ 0x41524453; // 'SDRA'
export const MagicHeader1 = /*#__PURE__*/ 0x464F5257; // 'WROF'

export const TemplateSectionLabel = /*#__PURE__*/ {
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

export const LYNX_TAG_TO_HTML_TAG_MAP: Record<string, string> =
  /*#__PURE__*/ Object.freeze(
    Object.assign(Object.create(null), {
      'view': 'x-view',
      'text': 'x-text',
      'image': 'x-image',
      'raw-text': 'raw-text',
      'scroll-view': 'x-scroll-view',
      'wrapper': 'lynx-wrapper',
      'list': 'x-list',
      'page': 'div',
      'input': 'x-input',
      'x-input-ng': 'x-input',
      'svg': 'x-svg',
    }),
  );

export const HTML_TAG_TO_LYNX_TAG_MAP: Record<string, string> =
  /*#__PURE__*/ Object.freeze(
    Object.assign(
      Object.create(null),
      Object.fromEntries(
        Object.entries(LYNX_TAG_TO_HTML_TAG_MAP).map(([k, v]) => [v, k]),
      ),
    ),
  );

/**
 * also see packages/web-platform/web-core-wasm/src/constants.rs
 */
export const LYNX_TAG_TO_DYNAMIC_LOAD_TAG_ID: Record<string, number> =
  /*#__PURE__*/ Object
    .freeze(
      Object.assign(Object.create(null), {
        'list': 0,
        'x-swiper': 1,
        'x-input': 2,
        'x-input-ng': 2,
        'input': 2,
        'x-textarea': 3,
        'x-audio-tt': 4,
        'x-foldview-ng': 5,
        'x-foldview-header-ng': 5,
        'x-foldview-slot-drag-ng': 5,
        'x-foldview-slot-ng': 5,
        'x-foldview-toolbar-ng': 5,
        'x-refresh-view': 6,
        'x-refresh-header': 6,
        'x-refresh-footer': 6,
        'x-overlay-ng': 7,
        'x-viewpager-ng': 8,
        'x-viewpager-item-ng': 8,
      }),
    );

export const scrollContainerDom = Symbol.for('lynx-scroll-container-dom');

export const loadUnknownElementEventName = 'loadUnknownElement';

export const enum IdentifierType {
  ID_SELECTOR, // css selector
  /**
   * @deprecated
   */
  REF_ID,
  UNIQUE_ID, // element_id
}

export const enum AnimationOperation {
  START = 0,
  PLAY,
  PAUSE,
  CANCEL,
  FINISH,
}
