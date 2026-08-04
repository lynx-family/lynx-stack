// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * A stub Lynx main-thread environment: enough element PAPI to evaluate a real
 * `main-thread.js` in a VM context, call `renderPage`, and inspect the element
 * tree it built.
 */

// biome-ignore lint/suspicious/noEmptyBlockStatements: the stubs are no-ops
const noop = (): void => {}

export interface StubElement {
  tag: string
  id: number
  children: StubElement[]
  attributes: Record<string, unknown>
}

export function createMainThreadEnv() {
  let nextId = 1
  const create = (tag: string): StubElement => ({
    tag,
    id: nextId++,
    children: [],
    attributes: {},
  })
  let page: StubElement | undefined
  const lifecycleEvents: unknown[][] = []

  const env: Record<string, unknown> = {
    console,
    setTimeout,
    clearTimeout,
    globDynamicComponentEntry: '__Card__',
    lynx: {
      __initData: {},
      getNativeApp: () => ({ callLepusMethod: noop }),
      reportError: (error: unknown) => {
        throw error
      },
      performance: {
        profileStart: noop,
        profileEnd: noop,
        profileMark: noop,
      },
      queueMicrotask: (fn: () => void) => void Promise.resolve().then(fn),
    },
    __CreatePage: () => (page = create('page')),
    __CreateView: () => create('view'),
    __CreateText: () => create('text'),
    __CreateImage: () => create('image'),
    __CreateRawText: (text: unknown) => {
      const element = create('raw-text')
      element.attributes['text'] = text
      return element
    },
    __CreateElement: (tag: string) => create(tag),
    __CreateWrapperElement: () => create('wrapper'),
    __CreateScrollView: () => create('scroll-view'),
    __CreateList: () => create('list'),
    __AppendElement: (parent: StubElement, child: StubElement) =>
      parent.children.push(child),
    __InsertElementBefore: (
      parent: StubElement,
      child: StubElement,
      before?: StubElement,
    ) => {
      const index = before ? parent.children.indexOf(before) : -1
      if (index === -1) {
        parent.children.push(child)
      } else {
        parent.children.splice(index, 0, child)
      }
    },
    __RemoveElement: (parent: StubElement, child: StubElement) => {
      parent.children = parent.children.filter(element => element !== child)
    },
    __ReplaceElement: (newElement: StubElement, oldElement: StubElement) => {
      const walk = (node: StubElement | undefined): boolean => {
        if (!node) return false
        const index = node.children.indexOf(oldElement)
        if (index !== -1) {
          node.children[index] = newElement
          return true
        }
        return node.children.some((child) => walk(child))
      }
      walk(page)
    },
    __SetAttribute: (
      element: StubElement,
      key: string,
      value: unknown,
    ) => (element.attributes[key] = value),
    __SetClasses: (
      element: StubElement,
      value: unknown,
    ) => (element.attributes['class'] = value),
    __SetInlineStyles: (
      element: StubElement,
      value: unknown,
    ) => (element.attributes['style'] = value),
    __SetID: (
      element: StubElement,
      value: unknown,
    ) => (element.attributes['id'] = value),
    __AddDataset: (
      element: StubElement,
      key: string,
      value: unknown,
    ) => (element.attributes[`data-${key}`] = value),
    __GetTag: (element: StubElement) => element.tag,
    __SetCSSId: noop,
    __AddEvent: noop,
    __SetEvents: noop,
    __FlushElementTree: noop,
    __GetPageElement: () => page,
    __GetElementUniqueID: (element: StubElement) => element.id,
    __GetTemplateParts: () => ({}),
    __ElementIsEqual: (a: StubElement, b: StubElement) => a === b,
    __OnLifecycleEvent: (event: unknown[]) => void lifecycleEvents.push(event),
    _ReportError: (error: unknown) => {
      throw error
    },
  }
  env['globalThis'] = env

  return {
    env,
    getPage: () => page,
    lifecycleEvents,
  }
}

export interface SerializedInstance {
  id: number
  type: string
  children?: SerializedInstance[] | undefined
}
