// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ComponentChildren, VNode } from 'preact';
import { cloneElement as cloneElementBackground, createElement as createElementBackground } from 'preact/compat';
import type { Attributes, ComponentType, ReactElement, ReactNode } from 'react';

import { cloneElement as cloneElementMainThread, createElement as createElementMainThread } from '@lynx-js/react/lepus';
import type { IntrinsicElements } from '@lynx-js/types';

import { getCloneSnapshotInfo, getCloneSnapshotType, isCompiledSnapshot } from '../snapshot/utils.js';

/**
 * The call signature of ReactLynx `createElement`.
 *
 * @public
 */
export interface CreateElement {
  /** Creates an element for a Lynx intrinsic element. */
  <Type extends keyof IntrinsicElements>(
    type: Type,
    props?: IntrinsicElements[Type] | null,
    ...children: ReactNode[]
  ): ReactElement<IntrinsicElements[Type], Type>;
  /** Creates an element for a component. */
  <Props extends object>(
    type: ComponentType<Props> | string,
    props?: (Attributes & Props) | null,
    ...children: ReactNode[]
  ): ReactElement<Props>;
}

/**
 * The call signature of ReactLynx `cloneElement`.
 *
 * @public
 */
export interface CloneElement {
  /** Clones an element with optional replacement props and children. */
  <Props>(
    element: ReactElement<Props>,
    props?: (Partial<Props> & Attributes) | null,
    ...children: ReactNode[]
  ): ReactElement<Props>;
}

type CreateElementParams = [
  type: VNode['type'],
  props: object | null | undefined,
  ...children: ComponentChildren[],
];

type CloneElementParams = [
  vnode: VNode<object>,
  props: object | null | undefined,
  ...children: ComponentChildren[],
];

function splitProps(
  props: CreateElementParams[1],
  rest: CreateElementParams[2][],
  initialKey: string | undefined = undefined,
): {
  key: string | undefined;
  children: CreateElementParams[2][];
  spreadProps: Record<string, ComponentChildren>;
} {
  let key = initialKey;
  let children = rest;
  let spreadProps: Record<string, ComponentChildren> = {};
  if (props && typeof props === 'object') {
    spreadProps = props as Record<string, ComponentChildren>;
    if ('key' in spreadProps) {
      const { key: keyValue, ...propsWithoutKey } = spreadProps;
      key = keyValue as string;
      spreadProps = propsWithoutKey;
    }
    if ('children' in spreadProps) {
      const { children: childrenValue, ...propsWithoutChildren } = spreadProps;
      if (rest.length === 0) {
        children = [childrenValue];
      }
      spreadProps = propsWithoutChildren;
    }
  }
  return {
    key,
    children,
    spreadProps,
  };
}

function pickChildrenProps(
  props: Record<string, ComponentChildren>,
): Record<string, ComponentChildren> | undefined {
  let childrenProps: Record<string, ComponentChildren> | undefined;
  for (const name in props) {
    if (name.startsWith('$')) {
      childrenProps ??= {};
      childrenProps[name] = props[name];
    }
  }
  return childrenProps;
}

/**
 * Creates a ReactLynx element using the snapshot runtime.
 *
 * @public
 */
export const createElement =
  (function(type: CreateElementParams[0], props: CreateElementParams[1], ...rest: CreateElementParams[2][]) {
    const _baseCreateElement = (__BACKGROUND__ ? createElementBackground : createElementMainThread) as (
      ...args: CreateElementParams
    ) => VNode;
    /**
     * for built-in element which would create snapshot instance
     *
     * 1. transform props to values
     * 2. transform children to $0 for slot v2
     */
    if (typeof type === 'string') {
      const { key, children, spreadProps } = splitProps(props, rest);
      return _baseCreateElement(
        type,
        Object.assign(
          {},
          {
            key,
            values: [{
              ...spreadProps,
              __spread: true,
            }],
          },
          children.length > 0 ? { $0: children.length > 1 ? children : children[0] } : undefined,
        ),
      );
    }
    return _baseCreateElement(type, props, ...rest);
  }) as CreateElement;

/**
 * Clones a ReactLynx element using the snapshot runtime.
 *
 * @public
 */
export const cloneElement =
  (function(vnode: CloneElementParams[0], props: CloneElementParams[1], ...rest: CloneElementParams[2][]) {
    const type = vnode.type;
    if (typeof type !== 'string') {
      // clone component by preact api
      return cloneElementBackground(vnode, props, ...rest);
    }
    if (!props && rest.length === 0) {
      // no props, no children. clone directly
      const _baseCloneElement = (__BACKGROUND__ ? cloneElementBackground : cloneElementMainThread) as (
        ...args: CloneElementParams
      ) => VNode<object>;
      return _baseCloneElement(vnode, props, ...rest);
    }
    const preProps = vnode.props as {
      values?: Record<string, ComponentChildren>[];
      $0?: CreateElementParams[2];
    };
    const preValues = preProps.values ?? [];
    const resolvedProps = splitProps(
      props,
      rest,
      vnode.key as string | undefined,
    );
    const { key, spreadProps } = resolvedProps;
    let { children } = resolvedProps;
    // raw element, merge props and reset children
    if (!isCompiledSnapshot(type)) {
      const nextProps = {
        ...(preValues[0] ?? {}),
        key,
        ...spreadProps,
      };
      if (children.length === 0 && '$0' in preProps) {
        children = [preProps.$0];
      }
      return (createElement as (...args: CreateElementParams) => VNode)(type, nextProps, ...children);
    }

    // normal compiled snapshot
    const values = preValues.slice();
    const _baseCreateElement = (__BACKGROUND__ ? createElementBackground : createElementMainThread) as (
      ...args: CreateElementParams
    ) => VNode;
    const { cloneSpreadIndex } = getCloneSnapshotInfo(type) ?? {};
    let cloneType = type;
    if (cloneSpreadIndex === undefined) {
      cloneType = getCloneSnapshotType(type, values.length);
      values.push({
        ...spreadProps,
        __spread: true,
      });
    } else {
      const preSpread = preValues[cloneSpreadIndex] ?? {};
      values[cloneSpreadIndex] = {
        ...preSpread,
        ...spreadProps,
        __spread: true,
      };
    }

    if (children.length > 0) {
      console.warn('cloneElement from compiled snapshot with children is not supported');
    }
    return _baseCreateElement(cloneType, {
      key,
      ...pickChildrenProps(preProps),
      values,
    });
  }) as CloneElement;
