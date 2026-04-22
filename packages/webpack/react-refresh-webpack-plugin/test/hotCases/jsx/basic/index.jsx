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

it('should call renderer', () =>
  new Promise(done => {
    // expect(renderContent.mock.calls[0][0]).toContain('content 1')
    NEXT(
      update(done, true, () => {
        // expect(renderContent.mock.calls[1][0]).toContain('content 2')
        NEXT(
          update(done, true, () => {
            // expect(renderContent.mock.calls[2][0]).toContain('content 3')
            done()
          }),
        )
      }),
    )
  }))

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept('./app.jsx')
}
