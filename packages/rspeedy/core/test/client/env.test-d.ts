// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/// <reference types="../../client.d.ts" />

import { describe, expectTypeOf, test } from 'vitest'

describe('Client - env type check', () => {
  describe('import.meta.webpackHot', () => {
    test('hot.accept', () => {
      expectTypeOf(import.meta.webpackHot)
        .exclude(undefined)
        .toHaveProperty('accept')
        .toBeCallableWith((error, { moduleId }) => {
          expectTypeOf(error).toEqualTypeOf<Error>()
          expectTypeOf(moduleId).toEqualTypeOf<string | number>()
        })

      expectTypeOf(import.meta.webpackHot)
        .exclude(undefined)
        .toHaveProperty('accept')
        .toBeCallableWith()
      expectTypeOf(import.meta.webpackHot?.accept('deps')).toBeVoid()
      expectTypeOf(import.meta.webpackHot?.accept(['deps'])).toBeVoid()
      expectTypeOf(
        import.meta.webpackHot?.accept(['deps'], (outdatedDependencies) => {
          expectTypeOf(outdatedDependencies).toEqualTypeOf<string[]>()
        }),
      ).toBeVoid()
    })

    test('hot.status', () => {
      expectTypeOf(import.meta.webpackHot)
        .exclude(undefined)
        .toHaveProperty('status')
        .toBeCallableWith()
      expectTypeOf(import.meta.webpackHot)
        .exclude(undefined)
        .toHaveProperty('status')
        .returns
        .toEqualTypeOf<
          Rspack.HotUpdateStatus
        >()
    })

    test('hot.check', () => {
      expectTypeOf(import.meta.webpackHot)
        .exclude(undefined)
        .toHaveProperty('check')
        .toBeCallableWith(true)

      expectTypeOf(import.meta.webpackHot)
        .exclude(undefined)
        .toHaveProperty('check')
        .toBeCallableWith({
          ignoreErrored: true,
          onAccepted(event) {
            expectTypeOf(event).toHaveProperty('type').toEqualTypeOf<
              'accepted'
            >()
            expectTypeOf(event).toHaveProperty('moduleId').toEqualTypeOf<
              string | number
            >()
            expectTypeOf(event).toHaveProperty('outdatedModules').toEqualTypeOf<
              (string | number)[]
            >()
            expectTypeOf(event).toHaveProperty('outdatedDependencies')
              .toEqualTypeOf<Record<number, (string | number)[]>>()
          },
        })
    })

    test('hot.apply', () => {
      expectTypeOf(import.meta.webpackHot)
        .exclude(undefined)
        .toHaveProperty('apply')
        .toBeCallableWith()
      expectTypeOf(import.meta.webpackHot)
        .exclude(undefined)
        .toHaveProperty('apply')
        .toBeCallableWith({
          ignoreErrored: true,
          onAccepted(event) {
            expectTypeOf(event).toHaveProperty('type').toEqualTypeOf<
              'accepted'
            >()
            expectTypeOf(event).toHaveProperty('moduleId').toEqualTypeOf<
              string | number
            >()
            expectTypeOf(event).toHaveProperty('outdatedModules').toEqualTypeOf<
              (string | number)[]
            >()
            expectTypeOf(event).toHaveProperty('outdatedDependencies')
              .toEqualTypeOf<Record<number, (string | number)[]>>()
          },
        })
    })

    test('hot.dispose', () => {
      expectTypeOf(import.meta.webpackHot)
        .exclude(undefined)
        .toHaveProperty('dispose')
        .toBeCallableWith(() => void 0)
    })

    test('hot.invalidate', () => {
      expectTypeOf(import.meta.webpackHot)
        .exclude(undefined)
        .toHaveProperty('invalidate')
        .toBeCallableWith()
    })
  })

  describe('import.meta.env', () => {
    test('default', () => {
      expectTypeOf(import.meta.env).toMatchTypeOf<Record<string, unknown>>()
    })

    test('custom importMeta', () => {
      expectTypeOf(import.meta.env).toHaveProperty('PUBLIC_FOO').toEqualTypeOf<
        string
      >()
    })
  })

  describe('Assets', () => {
    test('gif', () => {
      expectTypeOf(import('./baz.gif')).resolves.toMatchTypeOf<{
        default: string
      }>()
    })

    test('png', () => {
      expectTypeOf(import('./foo.png')).resolves.toMatchTypeOf<
        { default: string }
      >()
    })

    test('svg', () => {
      expectTypeOf(import('./bar.svg')).resolves.toMatchTypeOf<{
        default: string
      }>()
    })

    test('inline', () => {
      expectTypeOf(import('./foo.png?inline')).resolves.toMatchTypeOf<{
        default: string
      }>()
    })

    test('url', () => {
      expectTypeOf(import('./foo.png?url')).resolves.toMatchTypeOf<{
        default: string
      }>()
    })
  })

  describe('CSS Modules', () => {
    test('module.css', () => {
      expectTypeOf(import('./simple.module.css')).resolves.toMatchTypeOf<
        { default: Record<string, string> }
      >()
    })

    test('module.scss', () => {
      expectTypeOf(import('./simple.module.scss')).resolves.toMatchTypeOf<
        { default: Record<string, string> }
      >()
    })

    test('module.less', () => {
      expectTypeOf(import('./simple.module.less')).resolves.toMatchTypeOf<
        { default: Record<string, string> }
      >()
    })
  })
})
