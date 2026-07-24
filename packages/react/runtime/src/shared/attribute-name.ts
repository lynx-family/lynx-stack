// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export function normalizeCamelCaseAttributeName(name: string): string {
  let normalized: string | undefined;
  let segmentStart = 0;
  for (let index = 0; index < name.length; index++) {
    const characterCode = name.charCodeAt(index);
    if (characterCode < 65 || characterCode > 90) {
      continue;
    }

    normalized ??= '';
    normalized += name.slice(segmentStart, index);
    if (index !== 0) {
      normalized += '-';
    }
    normalized += String.fromCharCode(characterCode + 32);
    segmentStart = index + 1;
  }

  return normalized === undefined ? name : normalized + name.slice(segmentStart);
}
