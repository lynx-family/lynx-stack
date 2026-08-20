/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

export function loadAllWebElements(): Promise<void> {
  return import(
    /* webpackChunkName: "web-elements" */
    '@lynx-js/web-elements/all'
  ).then(() => {});
}

const dynamicWebElementLoaders: Record<string, () => Promise<unknown>> = {
  'animax-view': () =>
    import(
      /* webpackChunkName: "animax-view" */
      '@lynx-js/animax'
    ),
};

const dynamicWebElementLoadingPromises = new Map<string, Promise<void>>();

export function loadDynamicWebElement(
  tagName: string,
): Promise<void> | undefined {
  const loader = dynamicWebElementLoaders[tagName];
  if (!loader) {
    return undefined;
  }

  if (customElements.get(tagName)) {
    return Promise.resolve();
  }

  const existingPromise = dynamicWebElementLoadingPromises.get(tagName);
  if (existingPromise) {
    return existingPromise;
  }

  const loadingPromise = loader()
    .then(() => {
      if (!customElements.get(tagName)) {
        throw new Error(
          `The module for <${tagName}> did not register its custom element`,
        );
      }
    })
    .catch((error: unknown) => {
      dynamicWebElementLoadingPromises.delete(tagName);
      throw error;
    });
  dynamicWebElementLoadingPromises.set(tagName, loadingPromise);
  return loadingPromise;
}
