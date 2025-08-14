// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  DefineDceVisitorConfig,
  JsxTransformerConfig,
  ShakeVisitorConfig,
  SwcPluginReactLynxOptions,
} from '@lynx-js/react/transform/swc-plugin-reactlynx';
import type { CompatVisitorConfig } from '@lynx-js/react/transform/swc-plugin-reactlynx-compat';

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
export interface ReactLoaderOptions {
  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.compat}
   */
  compat?: CompatVisitorConfig | undefined;

  /**
   * {@inheritdoc @lynx-js/template-webpack-plugin#LynxTemplatePluginOptions.enableRemoveCSSScope}
   */
  enableRemoveCSSScope?: boolean | undefined;
  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.jsx}
   */
  jsx?: JsxTransformerConfig | undefined;

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
  defineDCE?: Partial<DefineDceVisitorConfig> | undefined;

  // TODO(BitterGourd): rename to lazy bundle.
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

function getCommonOptions(
  options: ReactLoaderOptions,
  isDev: boolean,
) {
  const {
    enableRemoveCSSScope,
    isDynamicComponent,
    defineDCE,
  } = options;

  const commonOptions = {
    // We need to set `mode: 'development'` for HMR to work
    mode: isDev ? 'development' : 'production',
    // Ensure that swc get a full absolute path so that it will generate
    // absolute path in the `source` param of `jsxDev(type, props, key, isStatic, source, self)`
    cssScope: {
      mode: getCSSScopeMode(enableRemoveCSSScope),
    },
    snapshot: {
      // In standalone lazy bundle mode, we do not support HMR now.
      target: isDev && !isDynamicComponent
        // Using `MIX` when HMR is enabled.
        // This allows serializing the updated runtime code to Lepus using `Function.prototype.toString`.
        ? 'MIXED'
        : 'JS',
      runtimePkg: RUNTIME_PKG,
      isDynamicComponent: isDynamicComponent ?? false,
    },
    worklet: {
      runtimePkg: RUNTIME_PKG,
      target: 'MIXED',
    },
    directiveDCE: false,
    defineDCE: {
      define: defineDCE?.define ?? {},
    },
  } satisfies Omit<SwcPluginReactLynxOptions, 'shake'>;

  return commonOptions;
}

export function getMainThreadTransformOptions(
  options: ReactLoaderOptions,
  isDev: boolean,
): SwcPluginReactLynxOptions {
  const commonOptions = getCommonOptions(options, isDev);

  const { shake } = options;

  return {
    ...commonOptions,
    snapshot: {
      ...commonOptions.snapshot,
      jsxImportSource: JSX_IMPORT_SOURCE.MAIN_THREAD,
      target: 'LEPUS',
    },
    dynamicImport: {
      layer: 'react__main-thread',
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
        ...typeof options.compat === 'object'
          ? options.compat.oldRuntimePkg
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
  options: ReactLoaderOptions,
  isDev: boolean,
): SwcPluginReactLynxOptions {
  const commonOptions = getCommonOptions(options, isDev);

  return {
    ...commonOptions,
    dynamicImport: {
      layer: 'react__background',
      runtimePkg: RUNTIME_PKG,
    },
    snapshot: {
      ...commonOptions.snapshot,
      jsxImportSource: JSX_IMPORT_SOURCE.BACKGROUND,
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

export function getCompatOptions(
  compat: CompatVisitorConfig | undefined,
  layer: string,
): CompatVisitorConfig | false {
  if (typeof compat !== 'object') return false;

  return {
    target: layer === LAYERS.MAIN_THREAD ? 'LEPUS' : 'JS',

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
