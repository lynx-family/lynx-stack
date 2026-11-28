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
  new Promise((done, fail) => {
    expect(renderContent.mock.calls[0][0]).toContain('content 1')
    NEXT(
      update(err => {
        expect(err).not.toBeUndefined()
        NEXT(
          // The failed build also emitted an update (the error module), so the
          // first check applies it; check again for the fix, as the dev server
          // client does until the app is up to date.
          update(done, true, async () => {
            try {
              await import.meta.webpackHot.check(true)
              await new Promise(resolve => setTimeout(resolve, 50))
              expect(renderContent.mock.lastCall[0]).toContain('content 3')
              done()
            } catch (error) {
              fail(error)
            }
          }),
        )
      }),
    )
  }))

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept()
}
