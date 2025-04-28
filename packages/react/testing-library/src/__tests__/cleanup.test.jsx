import { expect } from 'vitest';
import { render, cleanup } from '..';
import { Component } from '@lynx-js/react';

test('clean up the document', () => {
  const spy = vi.fn();
  const viewId = 'my-view';

  class Test extends Component {
    componentWillUnmount() {
      expect(elementTree).toMatchInlineSnapshot(`
        <page>
          <view
            id="my-view"
          />
        </page>
      `);
      spy();
    }
    render() {
      return <view id={viewId} />;
    }
  }

  render(<Test />);
  cleanup();
  expect(elementTree).toMatchInlineSnapshot(`undefined`);
  expect(spy).toHaveBeenCalledTimes(1);
});
