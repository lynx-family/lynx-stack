// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core'

import { validate } from '../src/validate.js'

describe('validate', () => {
  describe('unsupported keys', () => {
    test('multiple errors', () => {
      expect(() =>
        validate({
          foo: false,
          bar: false,
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: [pluginLynxConfig] Invalid configuration.

          Unsupported configuration: \`$input.foo\`

          Unsupported configuration: \`$input.bar\`
        ]
      `)
    })

    test('debugInfoOutside', () => {
      expect(() =>
        validate({
          debugInfoOutside: false,
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: [pluginLynxConfig] Invalid configuration.

          Unsupported configuration: \`$input.debugInfoOutside\`
        ]
      `)
    })

    test('defaultDisplayLinear', () => {
      expect(() =>
        validate({
          defaultDisplayLinear: false,
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: [pluginLynxConfig] Invalid configuration.

          Unsupported configuration: \`$input.defaultDisplayLinear\`
        ]
      `)
    })

    test('defaultOverflowVisible', () => {
      expect(() =>
        validate({
          defaultOverflowVisible: false,
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: [pluginLynxConfig] Invalid configuration.

          Unsupported configuration: \`$input.defaultOverflowVisible\`
        ]
      `)
    })

    test('enableCSSInvalidation', () => {
      expect(() =>
        validate({
          enableCSSInvalidation: false,
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: [pluginLynxConfig] Invalid configuration.

          Unsupported configuration: \`$input.enableCSSInvalidation\`
        ]
      `)
    })

    test('enableCSSSelector', () => {
      expect(() =>
        validate({
          enableCSSSelector: false,
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: [pluginLynxConfig] Invalid configuration.

          Unsupported configuration: \`$input.enableCSSSelector\`
        ]
      `)
    })

    test('enableRemoveCSSScope', () => {
      expect(() =>
        validate({
          enableRemoveCSSScope: false,
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: [pluginLynxConfig] Invalid configuration.

          Unsupported configuration: \`$input.enableRemoveCSSScope\`
        ]
      `)
    })

    test('targetSdkVersion', () => {
      expect(() =>
        validate({
          targetSdkVersion: '1.1.0',
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: [pluginLynxConfig] Invalid configuration.

          Unsupported configuration: \`$input.targetSdkVersion\`
        ]
      `)
    })

    test('customCSSInheritanceList', () => {
      expect(() =>
        validate({
          customCSSInheritanceList: [1, 2],
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: [pluginLynxConfig] Invalid configuration.

          Unsupported configuration: \`$input.customCSSInheritanceList\`
        ]
      `)
    })
  })

  test('unknown config', () => {
    expect(() =>
      validate({
        foo: 'bar',
      })
    ).toThrowErrorMatchingInlineSnapshot(`
      [Error: [pluginLynxConfig] Invalid configuration.

        Unsupported configuration: \`$input.foo\`
      ]
    `)
  })

  test('known config', () => {
    expect(() =>
      validate({
        enableAccessibilityElement: true,
        enableCSSInheritance: true,
        enableNewGesture: true,
      })
    ).not.toThrow()
  })
})
