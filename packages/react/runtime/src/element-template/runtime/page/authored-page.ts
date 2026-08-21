// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ComponentChild, FunctionalComponent } from 'preact';
import { useLayoutEffect } from 'preact/hooks';

import { useRef } from '@lynx-js/react/hooks';

import { __root } from './root-instance.js';

export type AuthoredPageAttributes = Record<string, unknown> | null;

export interface ElementTemplatePageProps {
  $0?: ComponentChild;
  attributes?: AuthoredPageAttributes;
  key?: unknown;
}

interface BackgroundAuthoredPageRoot {
  clearAuthoredPageAttributes(lifetime: object): void;
  setAuthoredPageAttributes(lifetime: object, attributes: AuthoredPageAttributes): void;
}

export const __ElementTemplatePage: FunctionalComponent<ElementTemplatePageProps> = function ElementTemplatePage(
  props,
): ComponentChild {
  const lifetime = useRef<object>({});
  const root = __root as unknown as BackgroundAuthoredPageRoot;

  if (__BACKGROUND__) {
    root.setAuthoredPageAttributes(lifetime.current, props.attributes ?? null);
    useLayoutEffect(() => () => root.clearAuthoredPageAttributes(lifetime.current), []);
  }

  return props.$0;
};
