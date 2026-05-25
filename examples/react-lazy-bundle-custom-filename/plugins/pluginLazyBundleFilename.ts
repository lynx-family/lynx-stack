import type { RsbuildPlugin } from '@lynx-js/rspeedy';

/**
 * The class name of the `LynxTemplatePlugin` instances that
 * `@lynx-js/react-rsbuild-plugin` registers (one per entry).
 */
const TEMPLATE_PLUGIN_NAME = 'LynxTemplatePlugin';

export interface PluginLazyBundleFilenameOptions {
  /**
   * The filename of the lazy bundle.
   *
   * Supports the `[name]` and `[fullhash]` placeholders, which are resolved by
   * the `LynxTemplatePlugin`.
   *
   * @defaultValue `'async/[name].[fullhash].bundle'`
   */
  lazyBundleFilename?: string;
}

/**
 * A demo Rsbuild plugin that overrides the `lazyBundleFilename` option of every
 * `LynxTemplatePlugin`.
 *
 * `@lynx-js/react-rsbuild-plugin` creates the template plugins per-entry inside
 * an async `modifyBundlerChain`, so they are not visible to a plain
 * `modifyBundlerChain` callback. The reliable place to reach the constructed
 * instances is `modifyRspackConfig`, which runs after the bundler chain is
 * resolved into a config but before the plugins' `apply()` is called — so
 * mutating `plugin.options` here takes effect.
 *
 * @example
 * ```ts
 * import { pluginLazyBundleFilename } from './plugins/pluginLazyBundleFilename.js';
 *
 * export default defineConfig({
 *   plugins: [
 *     pluginReactLynx(),
 *     pluginLazyBundleFilename({
 *       lazyBundleFilename: 'async/[name].[fullhash].bundle',
 *     }),
 *   ],
 * });
 * ```
 */
export function pluginLazyBundleFilename(
  options: PluginLazyBundleFilenameOptions = {},
): RsbuildPlugin {
  const { lazyBundleFilename = 'async/[name].[fullhash].bundle' } = options;

  return {
    name: 'plugin-lazy-bundle-filename',
    setup(api) {
      api.modifyRspackConfig((config) => {
        for (const plugin of config.plugins ?? []) {
          if (plugin?.constructor?.name !== TEMPLATE_PLUGIN_NAME) {
            continue;
          }
          // `LynxTemplatePlugin` stores the user options on `this.options` and
          // merges them with the defaults when `apply()` runs.
          const templatePlugin = plugin as { options?: Record<string, unknown> };
          templatePlugin.options ??= {};
          templatePlugin.options['lazyBundleFilename'] = lazyBundleFilename;
        }
      });
    },
  };
}
