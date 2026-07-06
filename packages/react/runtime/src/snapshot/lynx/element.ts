// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { cloneElement as cloneElementBackground, createElement as createElementBackground } from 'preact/compat';

import { cloneElement as cloneElementMainThread, createElement as createElementMainThread } from '@lynx-js/react/lepus';

import { getCloneSnapshotInfo, getCloneSnapshotType, isCompiledSnapshot } from '../snapshot/utils.js';

type CreateElement = typeof import('preact/compat').createElement;
type CreateElementParams = Parameters<CreateElement>;

type CloneElement = typeof import('preact/compat').cloneElement;
type CloneElementParams = Parameters<CloneElement>;

function splitProps(
  props: unknown,
  rest: CreateElementParams[2][],
  initialKey: string | undefined = undefined,
): {
  key: string | undefined;
  children: CreateElementParams[2][];
  spreadProps: Record<string, unknown>;
} {
  let key = initialKey;
  let children = rest;
  let spreadProps: Record<string, unknown> = {};
  if (props && typeof props === 'object') {
    spreadProps = props as Record<string, unknown>;
    if ('key' in spreadProps) {
      const { key: keyValue, ...propsWithoutKey } = spreadProps;
      key = keyValue as string;
      spreadProps = propsWithoutKey;
    }
    if ('children' in spreadProps) {
      const { children: childrenValue, ...propsWithoutChildren } = spreadProps;
      if (rest.length === 0) {
        children = [childrenValue as CreateElementParams[2]];
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

function pickChildrenProps(props: Record<string, unknown>): Record<string, unknown> | undefined {
  let childrenProps: Record<string, unknown> | undefined;
  for (const name in props) {
    if (name.startsWith('$')) {
      childrenProps ??= {};
      childrenProps[name] = props[name];
    }
  }
  return childrenProps;
}

/**
 * export to users, and in framework would use preact createElement directly
 */
export const createElement =
  (function(type: CreateElementParams[0], props: CreateElementParams[1], ...rest: CreateElementParams[2][]) {
    const _baseCreateElement = __BACKGROUND__ ? createElementBackground : createElementMainThread as CreateElement;
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
 * export to users, and in framework would use preact cloneElement directly
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
      const _baseCloneElement = __BACKGROUND__ ? cloneElementBackground : cloneElementMainThread as CloneElement;
      return _baseCloneElement(vnode, props, ...rest);
    }
    const preProps = vnode.props as unknown as {
      values?: Record<string, unknown>[];
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
      return createElement(type, nextProps, ...children);
    }

    // normal compiled snapshot
    const values = preValues.slice();
    const _baseCreateElement = __BACKGROUND__ ? createElementBackground : createElementMainThread as CreateElement;
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
