// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// import { createContext, createElement } from 'preact/compat';
// import { useState } from 'preact/hooks';
// import type { Consumer, FC, ReactNode } from 'react';
import type { ComponentChild, ContainerNode } from 'preact';
import { render } from 'preact';
import type { ReactNode } from 'react';

// import { factory, withInitDataInState } from '../../compat/initData.js';
import { profileEnd, profileStart } from '../../debug/profile.js';
// import { useLynxGlobalEventListener } from '../../hooks/useLynxGlobalEventListener.js';
import { __root } from '../runtime/page/root-instance.js';

/**
 * The default root exported by `@lynx-js/react` for you to render a JSX
 * @public
 */
export interface Root {
  /**
   * Use this API to pass in your JSX to render
   *
   * @example
   *
   * ```ts
   * import { root } from "@lynx-js/react"
   *
   * function App() {
   *   // Your app
   *   return <view>...</view>
   * }
   *
   * root.render(<App/>);
   * ```
   *
   * @public
   */
  render: (jsx: ReactNode) => void;
  // /**
  //  * {@inheritDoc Lynx.registerDataProcessors}
  //  * @deprecated use {@link Lynx.registerDataProcessors | lynx.registerDataProcessors} instead
  //  * @public
  //  */
  // registerDataProcessors: (dataProcessorDefinition: DataProcessorDefinition) => void;
}

/**
 * The default and only root of ReactLynx for you to render JSX
 * @example
 * ```ts
 * import { root } from "@lynx-js/react"
 * ```
 *
 * @public
 */
export const root: Root = {
  render: (jsx: ReactNode): void => {
    __root.__jsx = jsx;
    if (__BACKGROUND__) {
      if (__PROFILE__) {
        profileStart('ReactLynx::renderBackground');
      }
      render(jsx as ComponentChild, __root as unknown as ContainerNode);
      if (__PROFILE__) {
        profileEnd();
      }
    }
  },
  /* v8 ignore next 3 */
  // registerDataProcessors: (dataProcessorDefinition: DataProcessorDefinition): void => {
  //   lynx.registerDataProcessors(dataProcessorDefinition);
  // },
};
