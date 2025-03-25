// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  CompatVisitorConfig,
} from '@lynx-js/react/transform/swc-plugin-compat';
import type {
  DefineDCEVisitorConfig,
  JSXTransformerConfig,
  ShakeVisitorConfig,
  TransformNodiffOptions,
} from '@lynx-js/react/transform/swc-plugin-react-lynx';

import { LAYERS } from '../layer.js';

const JSX_IMPORT_SOURCE = {
  MAIN_THREAD: '@lynx-js/react/lepus',
  BACKGROUND: '@lynx-js/react',
};
const PUBLIC_RUNTIME_PKG = '@lynx-js/react';
const RUNTIME_PKG = '@lynx-js/react/internal';
const OLD_RUNTIME_PKG = '@lynx-js/react-runtime';
const COMPONENT_PKG = '@lynx-js/react-components';

/**
 * The options of the ReactLynx plugin.
 * @public
 */
export interface ReactLynxTransfromOptions {
  /**
   * {@inheritdoc @lynx-js/template-webpack-plugin#LynxTemplatePluginOptions.enableRemoveCSSScope}
   */
  enableRemoveCSSScope?: boolean | undefined;
  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.jsx}
   */
  jsx?: Partial<JSXTransformerConfig> | undefined;

  /**
   * Enable the Fast Refresh for ReactLynx.
   */
  refresh?: boolean | undefined;

  /**
   * How main-thread code will be shaken.
   */
  shake?: Partial<ShakeVisitorConfig> | undefined;

  /**
   * Like `define` in various bundlers, but this one happens at transform time, and a DCE pass will be performed.
   */
  defineDCE?: DefineDCEVisitorConfig | undefined;

  // TODO: rename to lazy bundle.
  /**
   * Whether is building standalone dynamic component.
   *
   * @internal
   */
  isDynamicComponent?: boolean | undefined;

  /**
   * The absolute path to `@lynx-js/react/transform`
   *
   * @internal
   */
  transformPath?: string | undefined;
}

function getCommonCompatOptions(
  compat: CompatVisitorConfig | boolean,
): CompatVisitorConfig | boolean {
  if (typeof compat !== 'object') return false;

  return {
    target: 'MIXED',

    addComponentElement: compat?.addComponentElement ?? false,

    additionalComponentAttributes: compat?.additionalComponentAttributes
      ?? [],

    componentsPkg: compat?.componentsPkg ?? [COMPONENT_PKG],

    disableDeprecatedWarning: compat?.disableDeprecatedWarning ?? false,

    newRuntimePkg: compat?.newRuntimePkg ?? PUBLIC_RUNTIME_PKG,

    oldRuntimePkg: compat?.oldRuntimePkg ?? [OLD_RUNTIME_PKG],

    simplifyCtorLikeReactLynx2: compat?.simplifyCtorLikeReactLynx2 ?? false,

    // NOTE: never pass '' (empty string) as default value
    ...(typeof compat?.removeComponentAttrRegex === 'string' && {
      removeComponentAttrRegex: compat?.removeComponentAttrRegex,
    }),

    darkMode: false,
  };
}

export function getMainThreadCompatOptions(
  compat: CompatVisitorConfig | boolean,
): CompatVisitorConfig | boolean {
  const commonCompatOptions = getCommonCompatOptions(compat);

  if (typeof commonCompatOptions !== 'object') return false;

  return {
    ...commonCompatOptions,
    target: 'LEPUS',
  };
}

export function getBackgroundCompatOptions(
  compat: CompatVisitorConfig | boolean,
): CompatVisitorConfig | boolean {
  const commonCompatOptions = getCommonCompatOptions(compat);

  if (typeof commonCompatOptions !== 'object') return false;

  return {
    ...commonCompatOptions,
    target: 'JS',
  };
}

function getCommonOptions(
  options: ReactLynxTransfromOptions,
  isDev: boolean,
) {
  const {
    enableRemoveCSSScope,
    isDynamicComponent,
    defineDCE = { define: {} },
  } = options;

  const filename = 'test.js';

  const commonOptions = {
    // We need to set `mode: 'development'` for HMR to work
    mode: isDev ? 'development' : 'production',

    // Ensure that swc get a full absolute path so that it will generate
    // absolute path in the `source` param of `jsxDev(type, props, key, isStatic, source, self)`
    filename,
    cssScope: {
      mode: getCSSScopeMode(enableRemoveCSSScope),
      filename,
    },
    // Ensure that Webpack will get a full absolute path in the sourcemap
    // so that it can properly map the module back to its internal cached
    // modules.
    // See: https://github.com/babel/babel-loader/blob/d85f4207947b618e040fb6a70afe9be9e1fd87d7/src/index.js#L135C1-L137C16
    // See: https://github.com/swc-project/pkgs/blob/d096fdc1ac372ac045894bdda3180ef99bbcbe33/packages/swc-loader/src/index.js#L42

    snapshot: {
      preserveJsx: false,
      target: 'MIXED',
      runtimePkg: RUNTIME_PKG,
      filename,
      isDynamicComponent: isDynamicComponent ?? false,
    },

    worklet: {
      filename,
      runtimePkg: RUNTIME_PKG,
      target: 'MIXED',
    },

    directiveDCE: false,
    defineDCE,
  } satisfies Partial<TransformNodiffOptions>;

  return commonOptions;
}

export function getMainThreadTransformOptions(
  options: ReactLynxTransfromOptions,
  compat: CompatVisitorConfig | boolean,
  isDev: boolean,
): TransformNodiffOptions {
  const commonOptions = getCommonOptions(options, isDev);

  const commonCompatOptions = getCommonCompatOptions(compat);

  const { shake } = options;

  return {
    ...commonOptions,
    snapshot: {
      ...commonOptions.snapshot,
      jsxImportSource: JSX_IMPORT_SOURCE.MAIN_THREAD,
      target: 'LEPUS',
    },
    dynamicImport: {
      layer: LAYERS.MAIN_THREAD,
      runtimePkg: RUNTIME_PKG,
    },
    defineDCE: {
      define: {
        ...commonOptions.defineDCE?.define,
        // DO NOT put lynx-speedy's defines here,
        // we want to handle as few as possible defines here.
        __LEPUS__: 'true',
        __MAIN_THREAD__: 'true',
        __JS__: 'false',
        __BACKGROUND__: 'false',
        __REACTLYNX2__: 'false',
        __REACTLYNX3__: 'true',
      },
    },
    shake: {
      // if shake is false, we will not shake anything
      // if shake is true, we will use default config from HERE,
      // so never pass true to shake to rust
      pkgName: [
        'react',
        PUBLIC_RUNTIME_PKG,
        `${PUBLIC_RUNTIME_PKG}/legacy-react-runtime`,
        RUNTIME_PKG,
        ...typeof commonCompatOptions === 'object'
          ? commonCompatOptions.oldRuntimePkg
          : [],
        ...(shake?.pkgName ?? []),
      ],
      retainProp: [
        'constructor',
        'render',
        'getDerivedStateFromProps',
        'state',
        'defaultDataProcessor',
        'dataProcessors',
        'contextType',
        'defaultProps',
        ...(shake?.retainProp ?? []),
      ],
      removeCallParams: [
        'useEffect',
        'useLayoutEffect',
        '__runInJS',
        'useLynxGlobalEventListener',
        'useImperativeHandle',
        ...(shake?.removeCallParams ?? []),
      ],
    },
    worklet: {
      ...commonOptions.worklet,
      target: 'LEPUS',
    },
    directiveDCE: {
      target: 'LEPUS',
    },
  };
}

export function getBackgroundTransformOptions(
  options: ReactLynxTransfromOptions,
  isDev: boolean,
): TransformNodiffOptions {
  const commonOptions = getCommonOptions(options, isDev);

  return {
    ...commonOptions,
    dynamicImport: {
      layer: LAYERS.BACKGROUND,
      runtimePkg: RUNTIME_PKG,
    },
    snapshot: {
      ...commonOptions.snapshot,
      jsxImportSource: JSX_IMPORT_SOURCE.BACKGROUND,
      target: isDev
        // Using `MIX` when HMR is enabled.
        // This allows serializing the updated runtime code to Lepus using `Function.prototype.toString`.
        ? 'MIXED'
        : 'JS',
    },
    defineDCE: {
      define: {
        ...commonOptions.defineDCE?.define,
        // DO NOT put lynx-speedy's defines here,
        // we want to handle as few as possible defines here.
        __LEPUS__: 'false',
        __MAIN_THREAD__: 'false',
        __JS__: 'true',
        __BACKGROUND__: 'true',
        __REACTLYNX2__: 'false',
        __REACTLYNX3__: 'true',
      },
    },
    shake: false,
    worklet: {
      ...commonOptions.worklet,
      target: 'JS',
    },
    directiveDCE: {
      target: 'JS',
    },
  };
}

function getCSSScopeMode(
  enableRemoveCSSScope?: boolean,
): 'modules' | 'all' | 'none' {
  if (enableRemoveCSSScope === true) {
    return 'none';
  } else if (enableRemoveCSSScope === false) {
    return 'all';
  } else {
    return 'modules';
  }
}
