// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface ParsedElementTemplateType {
  templateKey: string;
  bundleUrl: string | null;
}

export function parseElementTemplateType(type: string): ParsedElementTemplateType {
  const delimiter = type.lastIndexOf(':');
  if (delimiter < 0) {
    return {
      templateKey: type,
      bundleUrl: null,
    };
  }
  return {
    templateKey: type.slice(delimiter + 1),
    bundleUrl: type.slice(0, delimiter),
  };
}

export function elementTemplateIdentityKey(
  templateKey: string,
  bundleUrl: string | null | undefined,
): string {
  return bundleUrl == null ? templateKey : `${bundleUrl}:${templateKey}`;
}
