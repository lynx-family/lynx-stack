// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const lynxUniqueIdAttribute = 'l-uid' as const;

export const cssIdAttribute = 'l-css-id' as const;

export const componentIdAttribute = 'l-comp-id' as const;

export const parentComponentUniqueIdAttribute = 'l-p-comp-uid' as const;

export const lynxEntryNameAttribute = 'l-e-name' as const;

export const lynxTagAttribute = 'lynx-tag' as const;

export const lynxDatasetAttribute = 'l-dset' as const;

export const lynxComponentConfigAttribute = 'l-comp-cfg' as const;

export const lynxDisposedAttribute = 'l-disposed' as const;

export const lynxElementTemplateMarkerAttribute = 'l-template' as const;

export const lynxPartIdAttribute = 'l-part' as const;

export const lynxDefaultDisplayLinearAttribute =
  'lynx-default-display-linear' as const;

export const lynxDefaultOverflowVisibleAttribute =
  'lynx-default-overflow-visible' as const;

export const __lynx_timing_flag = '__lynx_timing_flag' as const;

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
