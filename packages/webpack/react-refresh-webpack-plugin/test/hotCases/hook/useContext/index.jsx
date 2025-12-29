/// <reference types="vitest/globals" />

import { root } from '@lynx-js/react'
import { update } from '@lynx-js/test-tools/update.js'
import { App } from './app.jsx'

const renderContent = vi.fn()
vi.stubGlobal('__RenderContent', value => {
  renderContent(value)
})

const callLepusMethod = vi.fn((_, __, callback) => {
  callback()
})

console.profile = vi.fn()
console.profileEnd = vi.fn()

lynx.getNativeApp = () => {
  return {
    callLepusMethod,
  };
}

root.render(
  <page>
    <App />
  </page>,
)

// Mocking Hydration
lynxCoreInject.tt.OnLifecycleEvent(['rLynxFirstScreen', {
  root: '{"values":[]}',
}])

it('should keep context', () =>
  new Promise(done => {
    expect(renderContent.mock.calls[0][0]).toEqual(`before: dark`)

    NEXT(
      update(done, true, async () => {
        expect(renderContent.mock.calls[0][0]).toEqual(`before: dark`)

        const { snapshotPatch } = JSON.parse(
          callLepusMethod.mock.calls[1][1].data,
        )
        expect(snapshotPatch.length).toBeGreaterThan(0)

        const addSnapshot = snapshotPatch.filter(patch =>
          patch[0] === /** SnapshotOperation.DEV_ONLY_AddSnapshot */ 100
        )
        expect(addSnapshot).toHaveLength(1)

        const [[/** opcode */, uniqId, create]] = addSnapshot

        // The new snapshot should contain the modified content(`after`)
        expect(create).toContain('after')

        // Should create the newly added snapshot in Background
        expect(snapshotPatch.find(patch =>
          patch[0] === /** SnapshotOperation.CreateElement */ 0
          && patch[1] === uniqId
        )).toHaveLength(1)
        done()
      }),
    )
  }))

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept('./app.jsx')
}
