import '@testing-library/jest-dom';
import { render } from '..';
import { expect } from 'vitest';
import { useEffect, useState } from '@lynx-js/react';

test('rerender will re-render the element', async () => {
  const Greeting = (props) => <text>{props.message}</text>;
  const { container, rerender } = render(<Greeting message='hi' />);
  expect(container).toMatchInlineSnapshot(`
    <page>
      <text>
        hi
      </text>
    </page>
  `);
  expect(container.firstChild).toHaveTextContent('hi');

  {
    const { container } = rerender(<Greeting message='hey' />);
    expect(container.firstChild).toHaveTextContent('hey');

    expect(container).toMatchInlineSnapshot(`
      <page>
        <text>
          hey
        </text>
      </page>
    `);
  }
});

test('rerender will flush pending hooks effects', async () => {
  const Component = () => {
    const [value, setValue] = useState(0);
    useEffect(() => {
      const timeoutId = setTimeout(() => {
        setValue(1);
      }, 0);
      return () => clearTimeout(timeoutId);
    });

    return value;
  };

  const { rerender } = render(<Component />);
  const { findByText } = rerender(<Component />);
  vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
  const callLepusMethod = lynxTestingEnv.backgroundThread.lynx.getNativeApp().callLepusMethod;
  expect(callLepusMethod.mock.calls).toMatchInlineSnapshot(`[]`);

  await findByText('1');

  vi.clearAllMocks();
});
