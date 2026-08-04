// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const lynxEventAttributeNameRegExp = /^(?:global-bind|bind|catch|capture-bind|capture-catch)[A-Za-z]+$/;
const namespacedEventKeyRegExp = /^[A-Za-z-]+:(?:global-bind|bind|catch|capture-bind|capture-catch)[A-Za-z]+$/;

export function isEventPropKey(key: string): boolean {
  return lynxEventAttributeNameRegExp.test(key);
}

export function isNamespacedEventPropKey(key: string): boolean {
  return namespacedEventKeyRegExp.test(key);
}

function isReactEventAttributeName(name: string): boolean {
  if (
    name.length <= 2
    || !name.startsWith('on')
  ) {
    return false;
  }

  let code = name.charCodeAt(2);
  if (code < 65 || code > 90) {
    return false;
  }
  for (let index = 3; index < name.length; index++) {
    code = name.charCodeAt(index);
    if (
      (code < 65 || code > 90)
      && (code < 97 || code > 122)
    ) {
      return false;
    }
  }
  return true;
}

function toDashCase(name: string): string {
  let index = 0;
  for (; index < name.length; index++) {
    const code = name.charCodeAt(index);
    if (code >= 65 && code <= 90) {
      break;
    }
  }

  if (index === name.length) {
    return name;
  }

  let transformed = name.slice(0, index);
  for (; index < name.length; index++) {
    const code = name.charCodeAt(index);
    if (code >= 65 && code <= 90) {
      if (index !== 0) {
        transformed += '-';
      }
      transformed += name[index]!.toLowerCase();
    } else {
      transformed += name[index];
    }
  }
  return transformed;
}

export function transformAttrName(name: string): string {
  const config = typeof __EXPERIMENTAL_TRANSFORM_BUILTIN_ATTRIBUTE_NAMES__ !== 'undefined'
    && __EXPERIMENTAL_TRANSFORM_BUILTIN_ATTRIBUTE_NAMES__;

  // A disabled config keeps every name unchanged.
  if (!config) {
    return name;
  }

  // An object config applies rules in `rename > preserve > mode` order.
  if (config !== true) {
    if (
      config.rename
      && Object.prototype.hasOwnProperty.call(config.rename, name)
    ) {
      return config.rename[name]!;
    }
    if (
      config.preserve?.includes(name)
      || config.mode === 'mapping-only'
    ) {
      return name;
    }
  }

  // Enabled configs keep native Lynx event names unchanged.
  if (isEventPropKey(name) || isNamespacedEventPropKey(name)) {
    return name;
  }

  // `true` and the default dash-case mode apply React-style event mappings.
  if (isReactEventAttributeName(name)) {
    if (name === 'onClick') {
      return 'bindtap';
    } else if (name === 'onCatchTap') {
      return 'catchtap';
    }
    return `bind${name.slice(2).toLowerCase()}`;
  }

  // Remaining names use dash-case when the transform is enabled.
  return toDashCase(name);
}
