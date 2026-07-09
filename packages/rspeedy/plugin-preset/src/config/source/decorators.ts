// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * {@inheritdoc Source.decorators}
 *
 * @public
 */
export interface Decorators {
  /**
   * Specify the decorator syntax version to be used.
   *
   * @defaultValue `'2022-03'`
   *
   * @remarks
   *
   * If you want to know the differences between different decorators versions, you can refer to: {@link https://github.com/tc39/proposal-decorators?tab=readme-ov-file#how-does-this-proposal-compare-to-other-versions-of-decorators | How does this proposal compare to other versions of decorators?}
   *
   * @example
   *
   * `'2022-03'` corresponds to the Stage 3 decorator proposal, equivalent to the decorator syntax supported by TypeScript 5.0 by default.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   source: {
   *     decorators: { version: '2022-03' },
   *   },
   * })
   * ```
   *
   * @example
   *
   * `'legacy'` corresponds to TypeScript's `experimentalDecorators: true`.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *   source: {
   *     decorators: { version: 'legacy' },
   *   },
   * })
   * ```
   */
  version?: 'legacy' | '2022-03'
}
