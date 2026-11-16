// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

declare function __GetPageElement(): object | undefined;
declare function __QuerySelector(
  element: object,
  selector: string,
  params: object,
): object | undefined;
declare function __GetElementUniqueID(element: object): number;

// EOM wrappers can change during hydration. Read the native identity without
// writing an owner attribute, which would schedule an extra EOM flush.
export function getIslandContainerId(selector: string): number | undefined {
  const page = __GetPageElement();
  const container = page && __QuerySelector(page, selector, {});
  return container ? __GetElementUniqueID(container) : undefined;
}
