// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
declare class ElementNode {}

declare function __AddInlineStyle(
  e: ElementNode,
  key: number | string,
  value: string,
): void;

declare function __FlushElementTree(element?: ElementNode): void;

declare function __GetAttributeByName(e: ElementNode, name: string): undefined | string;

declare function __GetAttributeNames(e: ElementNode): string[];

declare function __GetPageElement(): ElementNode;

declare function __InvokeUIMethod(
  e: ElementNode,
  method: string,
  params: Record<string, unknown>,
  callback: (res: { code: number; data: unknown }) => void,
): ElementNode[];

declare function __LoadLepusChunk(
  name: string,
  cfg: { chunkType: number; dynamicComponentEntry?: string | undefined },
): boolean;

declare function __QuerySelector(
  e: ElementNode,
  cssSelector: string,
  params: {
    onlyCurrentComponent?: boolean;
  },
): ElementNode | undefined;

declare function __QuerySelectorAll(
  e: ElementNode,
  cssSelector: string,
  params: {
    onlyCurrentComponent?: boolean;
  },
): ElementNode[];

declare function __SetAttribute(e: ElementNode, key: string, value: unknown): void;
