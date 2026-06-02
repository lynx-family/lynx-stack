// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Component } from 'preact';
import type { ReactNode } from 'react';

interface CompatComponentVNode {
  type: unknown;
  props: Record<string, unknown>;
}

export function wrapWithLynxComponent(
  jsxSnapshot: (c: ReactNode, spread?: Record<string, unknown>) => ReactNode,
  jsxComponent: ReactNode,
): ReactNode {
  const componentVNode = jsxComponent as CompatComponentVNode;
  const C = componentVNode.type;
  if (
    typeof C === 'function'
    && (C === ComponentFromReactRuntime
      || (C as { prototype?: unknown }).prototype instanceof ComponentFromReactRuntime)
  ) {
    if (jsxSnapshot.length === 1) {
      return jsxSnapshot(jsxComponent);
    } else {
      // spread
      if (!componentVNode.props['removeComponentElement']) {
        return jsxSnapshot(jsxComponent, takeComponentAttributes(componentVNode));
      }
    }
  }
  return jsxComponent;
}

export class ComponentFromReactRuntime extends Component {
  /* v8 ignore next 3 -- marker component, never rendered directly. */
  render(): null {
    return null;
  }
}

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

function takeComponentAttributes(jsxComponent: CompatComponentVNode): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};
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
