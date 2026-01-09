// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from 'vitest'

import { validate } from '../src/validate.js'

describe('validate', () => {
  describe('compile options', () => {
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
      ).not.toThrow()
    })

    test('defaultDisplayLinear', () => {
      expect(() =>
        validate({
          defaultDisplayLinear: false,
        })
      ).not.toThrow()
    })

    test('defaultOverflowVisible', () => {
      expect(() =>
        validate({
          defaultOverflowVisible: false,
        })
      ).not.toThrow()
    })

    test('enableCSSInvalidation', () => {
      expect(() =>
        validate({
          enableCSSInvalidation: false,
        })
      ).not.toThrow()
    })

    test('enableCSSSelector', () => {
      expect(() =>
        validate({
          enableCSSSelector: false,
        })
      ).not.toThrow()
    })

    test('enableRemoveCSSScope', () => {
      expect(() =>
        validate({
          enableRemoveCSSScope: false,
        })
      ).not.toThrow()
    })

    test('targetSdkVersion', () => {
      expect(() =>
        validate({
          targetSdkVersion: '1.1.0',
        })
      ).not.toThrow()

      expect(() =>
        validate({
          targetSdkVersion: false,
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: [pluginLynxConfig] Invalid configuration.

        Invalid config on \`$input.targetSdkVersion\`.
          - Expect to be (string | undefined)
          - Got: boolean
        ]
      `)
    })
  })

  describe('invalid config', () => {
    test('customCSSInheritanceList', () => {
      expect(() =>
        validate({
          customCSSInheritanceList: [1, 2],
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: [pluginLynxConfig] Invalid configuration.

        Invalid config on \`$input.customCSSInheritanceList[0]\`.
          - Expect to be string
          - Got: number

        Invalid config on \`$input.customCSSInheritanceList[1]\`.
          - Expect to be string
          - Got: number
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
        customCSSInheritanceList: ['foo', 'bar'],
        enableCSSInheritance: true,
        enableNewGesture: true,
        pipelineSchedulerConfig: 1,
      })
    ).not.toThrow()
  })
})
