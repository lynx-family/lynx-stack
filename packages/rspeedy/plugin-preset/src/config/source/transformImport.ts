// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * {@inheritdoc Source.transformImport}
 *
 * @public
 */
export interface TransformImport {
  /**
   * Whether to convert camelCase imports to kebab-case.
   *
   * @defaultValue Rsbuild defaults this option to `true`.
   *
   * @example
   *
   * - Input:
   *
   * ```js
   * import { ButtonGroup } from 'foo'
   * ```
   *
   * - Output:
   *
   * When set to `true`:
   * ```js
   * import ButtonGroup from 'foo/button-group'
   * ```
   *
   * When set to `false`:
   * ```js
   * import ButtonGroup from 'foo/ButtonGroup'
   * ```
   */
  camelToDashComponentName?: boolean | undefined

  /**
   * Customize the transformed path.
   *
   * @defaultValue undefined
   *
   * @remarks
   *
   * You you can specify the format of the transformed path.
   * For example, by setting it to `my-lib/{{ camelCase member }}`, you can convert the member into camelCase.
   *
   * The following formats are supported:
   *
   * - `kebabCase`: lowercase letters, words joined by hyphens. For example: `my-variable-name`.
   *
   * - `snakeCase`: lowercase letters, words joined by underscores. For example: `my_variable_name`.
   *
   * - `camelCase`: first letter lowercase, the first letter of each following word uppercase. For example: `myVariableName`.
   *
   * - `upperCase`: uppercase letters, other characters unchanged. For example: `MY-VARIABLE-NAME`.
   *
   * - `lowerCase`: lowercase letters, other characters unchanged. For example: `my-variable-name`.
   */
  customName?: string | undefined

  /**
   * The original import path that needs to be transformed.
   *
   * @remarks
   *
   * This option is required.
   */
  libraryName: string

  /**
   * Used to splice the transformed path, the splicing rule is `${libraryName}/${libraryDirectory}/${member}`, where member is the imported member.
   *
   * @defaultValue `'lib'`
   *
   * @example
   *
   * - Input:
   *
   * ```js
   * import { Button } from 'foo'
   * ```
   *
   * - Output:
   *
   * ```js
   * import Button from 'foo/lib/button'
   * ```
   */
  libraryDirectory?: string | undefined

  /**
   * Whether to convert import statements to default imports.
   *
   * @defaultValue Rsbuild defaults this option to `true`.
   *
   * @example
   *
   * - Input:
   *
   * ```js
   * import { Button } from 'foo'
   * ```
   *
   * - Output:
   *
   * When set to `true`:
   * ```js
   * import Button from 'foo/button'
   * ```
   *
   * When set to `false`:
   * ```js
   * import { Button } from 'foo/button'
   * ```
   */
  transformToDefaultImport?: boolean | undefined
}
