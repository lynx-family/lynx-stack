// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface ParsedElementTemplateType {
  templateKey: string;
  bundleUrl: string | null;
}

/**
 * The `globDynamicComponentEntry` value baked into main-bundle templates. It
 * denotes "the main card", which is equivalent to having no `bundleUrl`, so it
 * normalizes to `null` everywhere the template type is parsed.
 */
export const MAIN_BUNDLE_URL_SENTINEL = '__Card__';

export function parseElementTemplateType(type: string): ParsedElementTemplateType {
  const delimiter = type.lastIndexOf(':');
  if (delimiter < 0) {
    return {
      templateKey: type,
      bundleUrl: null,
    };
  }
  const bundleUrl = type.slice(0, delimiter);
  return {
    templateKey: type.slice(delimiter + 1),
    bundleUrl: bundleUrl === MAIN_BUNDLE_URL_SENTINEL ? null : bundleUrl,
  };
}

/**
 * The native identity for a template: the bundle-scoped key the main-thread
 * registers it under. The main card has no bundle, so its sentinel is stripped
 * to a bare `templateKey` (preserving native behavior); lazy bundles keep their
 * `${bundleUrl}:${templateKey}` form.
 */
export function elementTemplateIdentityKey(
  templateKey: string,
  bundleUrl: string | null | undefined,
): string {
  return bundleUrl == null ? templateKey : `${bundleUrl}:${templateKey}`;
}

/**
 * The full `${globDynamicComponentEntry}:${templateKey}` tag the transform bakes
 * into compiled templates and uses as the `__etAttrPlanMap` key. It always keeps
 * the `__Card__` sentinel for the main card (unlike {@link elementTemplateIdentityKey},
 * which strips it). Inverse of {@link parseElementTemplateType}.
 */
export function elementTemplateTypeTag(
  templateKey: string,
  bundleUrl: string | null | undefined,
): string {
  return `${bundleUrl ?? MAIN_BUNDLE_URL_SENTINEL}:${templateKey}`;
}
