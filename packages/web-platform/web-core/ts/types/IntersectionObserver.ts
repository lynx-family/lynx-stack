// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type IntersectionObserverMargins = {
  left?: number | string;
  right?: number | string;
  top?: number | string;
  bottom?: number | string;
};

export type LynxIntersectionObserverOptions = {
  thresholds?: number[];
  initialRatio?: number;
  observeAll?: boolean;
};

export type LynxIntersectionObserverRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type LynxIntersectionObserverEntry = {
  relativeRect: LynxIntersectionObserverRect;
  boundingClientRect: LynxIntersectionObserverRect;
  intersectionRect: LynxIntersectionObserverRect;
  intersectionRatio: number;
  isIntersecting: boolean;
  time: number;
  observerId: string;
};

export type LynxIntersectionObserverCommand =
  | {
    type: 'create';
    observerId: number;
    componentId: string;
    options: LynxIntersectionObserverOptions;
  }
  | {
    type: 'relativeTo';
    observerId: number;
    selector: string;
    margins: IntersectionObserverMargins;
  }
  | {
    type: 'relativeToViewport' | 'relativeToScreen';
    observerId: number;
    margins: IntersectionObserverMargins;
  }
  | {
    type: 'observe';
    observerId: number;
    selector: string;
    callbackId: number;
  }
  | {
    type: 'disconnect';
    observerId: number;
  };
