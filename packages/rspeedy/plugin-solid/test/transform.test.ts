// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@rstest/core'

import { transformSolidElementTemplates } from '../src/transform.js'

test('converts Solid DOM templates into Lynx Element Template fragments', () => {
  const result = transformSolidElementTemplates(
    `
      import {
        insert as _$insert,
        setAttribute as _$setAttribute,
        template as _$template,
      } from '@lynx-js/solid'

      const _tmpl$ = _$template(
        \`<svg><view class=card><text>Count</text><text></text><view class=button><text>Increment</svg>\`,
        false,
        true,
        false,
      )

      export const App = props => (() => {
        const root = _tmpl$()
        const label = root.firstChild
        const value = label.nextSibling
        const button = value.nextSibling
        _$insert(value, () => props.count)
        _$setAttribute(button, 'bindtap', props.onTap)
        return root
      })()
    `,
    '/src/App.tsx',
  )

  expect(result.code).toMatch(
    /createTemplate as _\$template/,
  )
  expect(result.code).toMatch(
    /_\$template\("_solid_et_[a-f0-9]+"\)/,
  )
  expect(result.code).toContain(
    '_setTemplateText(root, 0, () => props.count)',
  )
  expect(result.code).toContain('_effect(() => {')
  expect(result.code).toContain(
    '_setTemplateAttribute(root, 1, "bindtap", props.onTap)',
  )
  expect(result.code).not.toContain('firstChild')
  expect(result.code).not.toContain('nextSibling')
  expect(result.code).not.toContain('<svg>')
  expect(result.elementTemplates).toHaveLength(1)

  const template = result.elementTemplates[0]!.compiledTemplate
  expect(template).toEqual({
    kind: 'element',
    type: 'view',
    attributesArray: [{
      kind: 'static',
      key: 'class',
      value: 'card',
    }],
    children: [
      {
        kind: 'element',
        type: 'text',
        attributesArray: [],
        children: [{
          kind: 'element',
          type: 'raw-text',
          attributesArray: [{
            kind: 'static',
            key: 'text',
            value: 'Count',
          }],
          children: [],
        }],
      },
      {
        kind: 'element',
        type: 'text',
        attributesArray: [],
        children: [
          {
            kind: 'element',
            type: 'raw-text',
            attributesArray: [{
              kind: 'slot',
              key: 'text',
              attrSlotIndex: 0,
            }],
            children: [],
          },
        ],
      },
      {
        kind: 'element',
        type: 'view',
        attributesArray: [
          {
            kind: 'slot',
            key: 'bindtap',
            attrSlotIndex: 1,
          },
          {
            kind: 'static',
            key: 'class',
            value: 'button',
          },
        ],
        children: [{
          kind: 'element',
          type: 'text',
          attributesArray: [],
          children: [{
            kind: 'element',
            type: 'raw-text',
            attributesArray: [{
              kind: 'static',
              key: 'text',
              value: 'Increment',
            }],
            children: [],
          }],
        }],
      },
    ],
  })
  expect(result.code).not.toContain('textContentAttributeSlotIndex')
})

test('merges text slots into Solid attribute effects', () => {
  const result = transformSolidElementTemplates(
    `
      import {
        effect as _$effect,
        insert as _$insert,
        setAttribute as _$setAttribute,
        template as _$template,
      } from '@lynx-js/solid'

      const _tmpl$ = _$template(
        \`<svg><view><text></text></svg>\`,
        false,
        true,
        false,
      )

      export const App = props => (() => {
        const root = _tmpl$()
        const value = root.firstChild
        _$insert(value, props.count)
        _$effect(previous => {
          const className = props.className
          const id = props.id
          className !== previous.className
            && _$setAttribute(root, 'class', previous.className = className)
          id !== previous.id
            && _$setAttribute(root, 'id', previous.id = id)
          return previous
        }, { className: undefined, id: undefined })
        return root
      })()
    `,
    '/src/App.tsx',
  )

  expect(result.code.match(/_\$effect\(/g)).toHaveLength(1)
  const effect = result.code.slice(result.code.indexOf('_$effect('))
  expect(effect).toContain(
    '_setTemplateText(root, 2, props.count)',
  )
  expect(effect).toContain(
    '_setTemplateAttribute(root, 0, "class"',
  )
  expect(effect).toContain(
    '_setTemplateAttribute(root, 1, "id"',
  )
})

test('merges text slots into concise attribute effects', () => {
  const result = transformSolidElementTemplates(
    `
      import {
        effect as _$effect,
        insert as _$insert,
        setAttribute as _$setAttribute,
        template as _$template,
      } from '@lynx-js/solid'

      const _tmpl$ = _$template(
        \`<svg><view><text></text><view></view></view></svg>\`,
        false,
        true,
        false,
      )

      export const App = props => (() => {
        const root = _tmpl$()
        const value = root.firstChild
        const actions = value.nextSibling
        _$insert(value, props.count)
        _$effect(() =>
          _$setAttribute(actions, 'class', props.className)
        )
        return root
      })()
    `,
    '/src/App.tsx',
  )

  expect(result.code.match(/_\$effect\(/g)).toHaveLength(1)
  const effect = result.code.slice(result.code.indexOf('_$effect('))
  expect(effect).toContain(
    '_setTemplateText(root, 0, props.count)',
  )
  expect(effect).toContain(
    'return _setTemplateAttribute(root, 1, "class", props.className)',
  )
})

test('maps Solid insertion anchors to fragment child slots', () => {
  const result = transformSolidElementTemplates(
    `
      import {
        insert as _$insert,
        template as _$template,
      } from '@lynx-js/solid'

      const _tmpl$ = _$template(
        \`<svg><view><text>A</text><text>B</svg>\`,
        false,
        true,
        false,
      )

      export const App = props => (() => {
        const root = _tmpl$()
        const first = root.firstChild
        const second = first.nextSibling
        _$insert(root, () => props.before, second)
        _$insert(root, () => props.after, null)
        return root
      })()
    `,
    '/src/App.tsx',
  )

  expect(
    result.elementTemplates[0]!.compiledTemplate['children'],
  ).toEqual([
    expect.objectContaining({ type: 'text' }),
    {
      kind: 'childSlot',
      type: 'slot',
      elementSlotIndex: 0,
    },
    expect.objectContaining({ type: 'text' }),
    {
      kind: 'childSlot',
      type: 'slot',
      elementSlotIndex: 1,
    },
  ])
  expect(result.code).toContain(
    '_insertTemplateChild(root, 0, () => props.before)',
  )
  expect(result.code).toContain(
    '_insertTemplateChild(root, 1, () => props.after)',
  )
  expect(result.code).not.toContain('firstChild')
  expect(result.code).not.toContain('nextSibling')
})
