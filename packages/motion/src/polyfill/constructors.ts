// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { ElementCompt } from './element.js';

export { ElementCompt as Element, ElementCompt as EventTarget };
export const HTMLElement: typeof ElementCompt = ElementCompt;
export class SVGElement {}
export class NodeList {}
