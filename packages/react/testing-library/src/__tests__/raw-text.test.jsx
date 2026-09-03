import '@testing-library/jest-dom';
import { rs } from '@rstest/core';
import { render, fireEvent } from '..';
import { expect } from '@rstest/core';

test('raw-text should be created by `__CreateRawText`', async () => {
  rs.spyOn(lynxTestingEnv.mainThread.globalThis, '__CreateRawText');
  rs.spyOn(lynxTestingEnv.mainThread.globalThis, '__CreateElement');

  function App() {
    return (
      <view
        data-testid='view'
        bindtap={() => {
          lynx.createSelectorQuery().select('#text').setNativeProps({
            text: 'New text set by setNativeProps',
          }).exec();
        }}
      >
        <text id='text' data-testid='text'>{'Hello from App'}</text>
      </view>
    );
  }

  const { container, getByTestId } = render(<App />);

  expect(lynxTestingEnv.mainThread.globalThis.__CreateRawText).toBeCalledTimes(1);
  expect(lynxTestingEnv.mainThread.globalThis.__CreateElement.mock.calls.filter(call => call[0] === 'raw-text').length)
    .toBe(0);

  expect(getByTestId('text')).toHaveTextContent('Hello from App');

  fireEvent.tap(getByTestId('view'), {
    eventType: 'bindEvent',
  });
  expect(getByTestId('text').attributes).toMatchInlineSnapshot(`
    NamedNodeMap {
      "data-testid": "text",
      "id": "text",
      "text": "New text set by setNativeProps",
    }
  `);

  expect(container).toMatchInlineSnapshot(`
    <page>
      <view
        data-testid="view"
      >
        <text
          data-testid="text"
          id="text"
          text="New text set by setNativeProps"
        >
          Hello from App
        </text>
      </view>
    </page>
  `);
});
