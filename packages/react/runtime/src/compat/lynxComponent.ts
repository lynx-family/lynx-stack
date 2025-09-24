// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Component } from 'preact';
import type { ReactNode } from 'react';

export function wrapWithLynxComponent(
  jsxSnapshot: (c: ReactNode, spread?: Record<string, any>) => ReactNode,
  jsxComponent: any,
): ReactNode {
  const C = jsxComponent.type;
  if (
    typeof C === 'function' && (C === ComponentFromReactRuntime || C.prototype instanceof ComponentFromReactRuntime)
  ) {
    if (jsxSnapshot.length === 1) {
      return jsxSnapshot(jsxComponent);
    } else {
      // spread
      if (!jsxComponent.props.removeComponentElement) {
        return jsxSnapshot(jsxComponent, takeComponentAttributes(jsxComponent));
      }
    }
  }
  return jsxComponent;
}

// @ts-expect-error
export class ComponentFromReactRuntime extends Component {}

const __COMPONENT_ATTRIBUTES__ = /* @__PURE__ */ new Set([
  'name',
  'style',
  'class',
  'flatten',
  'clip-radius',
  'overlap',
  'user-interaction-enabled',
  'native-interaction-enabled',
  'block-native-event',
  'enableLayoutOnly',
  'cssAlignWithLegacyW3C',
  'intersection-observers',
  'trigger-global-event',
  'exposure-scene',
  'exposure-id',
  'exposure-screen-margin-top',
  'exposure-screen-margin-bottom',
  'exposure-screen-margin-left',
  'exposure-screen-margin-right',
  'focusable',
  'focus-index',
  'accessibility-label',
  'accessibility-element',
  'accessibility-traits',
  'enable-new-animator',
]);

function takeComponentAttributes(jsxComponent: any): Record<string, any> {
  const attributes: Record<string, any> = {};
  Object.keys(jsxComponent.props).forEach((k) => {
    // let re1 = Regex::new(r"^(global-bind|bind|catch|capture-bind|capture-catch)([A-Za-z]+)$").unwrap();
    // let re2 = Regex::new(r"^data-([A-Za-z]+)$").unwrap();
    if (
      __COMPONENT_ATTRIBUTES__.has(k)
      || k === 'id'
      || k === 'className'
      || k === 'dataSet'
      || k === 'data-set'
      || k === 'removeComponentElement'
      || (/^(global-bind|bind|catch|capture-bind|capture-catch)([A-Za-z]+)$/.exec(k))
      || (/^data-([A-Za-z]+)$/.exec(k))
    ) {
      attributes[k] = jsxComponent.props[k];
      delete jsxComponent.props[k];
    }
  });

  return attributes;
}
