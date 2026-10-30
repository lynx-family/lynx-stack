// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// Capture availability during entry evaluation, before later modules can patch it.
globalThis.__hasOwnAtEntry = typeof Object.hasOwn === 'function'
  && Object.hasOwn({ own: true }, 'own')

globalThis.__checkHasOwn = () => {
  const symbol = Symbol('key')
  const object = Object.assign(Object.create({ inherited: true }), {
    own: undefined,
    hasOwnProperty: () => false,
    [symbol]: true,
  })
  const { hasOwn } = Object
  let rejectsNull = false
  try {
    hasOwn(null, 'key')
  } catch (error) {
    rejectsNull = error instanceof TypeError
  }
  return [
    Object.hasOwn(object, 'own'),
    Object.hasOwn(object, 'inherited'),
    Object['hasOwn'](object, symbol),
    hasOwn(Object.assign(Object.create(null), { own: true }), 'own'),
    hasOwn('abc', 0),
    rejectsNull,
  ]
}
