// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const lynxUniqueIdAttribute = 'l-uid' as const;

export const cssIdAttribute = 'l-css-id' as const;

export const componentIdAttribute = 'l-comp-id' as const;

export const parentComponentUniqueIdAttribute = 'l-p-comp-uid' as const;

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

export const globalMuteableVars = [
  'registerDataProcessor',
  'registerWorkletInternal',
  'lynxWorkletImpl',
  'runWorklet',
] as const;

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
  `@property --lynx-display {
    syntax: "linear | flex";
    inherits: false;
    initial-value: linear;
  }`,
  `@property --lynx-linear-weight-sum {
    syntax: "<number>";
    inherits: false;
    initial-value: 1;
  }`,
  `@property --lynx-linear-weight {
    syntax: "<number>";
    inherits: false;
    initial-value: 0;
  }`,
  `@property --justify-content-column {
    syntax: "flex-start|flex-end|center|space-between|space-around";
    inherits: false;
    initial-value: flex-start;
  }`,
  `@property --justify-content-column-reverse {
    syntax: "flex-start|flex-end|center|space-between|space-around";
    inherits: false;
    initial-value: flex-start;
  }`,
  `@property --justify-content-row {
    syntax: "flex-start|flex-end|center|space-between|space-around";
    inherits: false;
    initial-value: flex-start;
  }`,
  `
  @property --justify-content-row-reverse {
    syntax: "flex-start|flex-end|center|space-between|space-around";
    inherits: false;
    initial-value: flex-start;
  }`,
  `@property --align-self-row {
    syntax: "start|end|center|stretch|auto";
    inherits: false;
    initial-value: auto;
  }`,
  `@property --align-self-column {
    syntax: "start|end|center|stretch|auto";
    inherits: false;
    initial-value: auto;
  }`,
  `@property --lynx-linear-weight-basis {
    syntax: "auto|<number>|<length>";
    inherits: false;
    initial-value: auto;
  }`,
  `@property --lynx-linear-orientation {
    syntax: "<custom-ident>";
    inherits: false;
    initial-value: vertical;
  }`,
  `@property --flex-direction {
    syntax: "*";
    inherits: false;
  }`,
  `@property --flex-wrap {
    syntax: "*";
    inherits: false;
  }`,
  `@property --flex-grow {
    syntax: "<number>";
    inherits: false;
    initial-value: 0;
  }`,
  `@property --flex-shrink {
    syntax: "<number>";
    inherits: false;
    initial-value: 1;
  }`,
  `@property --flex-basis {
    syntax: "*";
    inherits: false;
    initial-value: auto;
  }`,
  `@property --flex-value {
    syntax: "*";
    inherits: false;
  }`,
  `@property --linear-justify-content {
    syntax: "flex-start|flex-end|center|space-between|space-around";
    inherits: false;
    initial-value: flex-start;
  }`,
];
