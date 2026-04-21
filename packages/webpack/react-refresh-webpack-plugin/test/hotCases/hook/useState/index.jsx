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

it('should keep state', () =>
  new Promise(done => {
    expect(renderContent.mock.calls[0][0]).toEqual(`before: light`)
    setTimeout(() => {
      expect(renderContent.mock.calls[1][0]).toEqual(`before: dark`)
      NEXT(
        update(done, true, () => {
          expect(renderContent.mock.calls[2][0]).toEqual(`after: dark`)
          done()
        }),
      )
    }, 200)
  }))

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept('./app.jsx')
}
