// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// true
const getI18nNext = () => __I18N__NEXT;

let jsResourceStr = '';
export const getJSResourceStr = () => {
  if (!jsResourceStr) {
    // jsResourceStr = lynx.getI18nResource();
  }
  return jsResourceStr;
};
let jsResource = null;
export const getJSResource = () => {
  if (!jsResource) {
    try {
      jsResource = JSON.parse(getJSResourceStr());
    } catch (e) {}
  }
  return jsResource;
};

let runtimeResource = null;
const getResource = () => {
  if (!runtimeResource) {
    if (globalThis.__I18N__NEXT__LEPUS) {
      runtimeResource = globalThis.__I18N__RESOURCES[globalThis.__I18N__LOCALE];
    } else if (globalThis.__I18N__RESOURCES && !getI18nNext()) {
      runtimeResource = globalThis.__I18N__RESOURCES[globalThis.__I18N__LOCALE];
    } else {
      // runtimeResource = getJSResource();
      console.log('getJSResource');
    }
  }
  return runtimeResource;
};

export const t = (key) => {
  try {
    const resource = getResource();
    if (!resource) {
      return '';
    }

    const text = resource[key] || '';
    return text;
  } catch (error) {
  }
  return '';
};
