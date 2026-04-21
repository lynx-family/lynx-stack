import { root } from '@lynx-js/react'
import { update } from '@lynx-js/test-tools/update.js'
import { App } from './app.jsx'

const renderContent = rstest.fn()
rstest.stubGlobal('__RenderContent', value => {
  renderContent(value)
})

root.render(
  <page>
    <App />
  </page>,
)

it('should recovery from error', () =>
  new Promise(done => {
    expect(renderContent.mock.calls[0][0]).toContain('content 1')
    NEXT(
      update(err => {
        expect(err).not.toBeUndefined()
        NEXT(
          update(done, true, () => {
            expect(renderContent.mock.calls[0][0]).toContain('content 3')
            done()
          }),
        )
      }),
    )
  }))

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept()
}
