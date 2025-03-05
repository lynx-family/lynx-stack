import '@lynx-js/lynx-dom-jest-matchers';
import { render, waitSchedule } from '..';
import { expect } from 'vitest';
import { useEffect, useState } from '@lynx-js/react';

test('rerender will re-render the element', async () => {
  const Greeting = (props) => <text>{props.message}</text>;
  const { container, rerender } = render(<Greeting message='hi' />);
  expect(container).toMatchInlineSnapshot(`
    <page
      cssId="__Card__:0"
    >
      <text>
        <raw-text
          text="hi"
        />
      </text>
    </page>
  `);
  expect(container.children[0]).toHaveTextContent('hi');

  {
    const { container } = rerender(<Greeting message='hey' />);
    expect(container.children[0]).toHaveTextContent('hey');

    expect(container).toMatchInlineSnapshot(`
      <page
        cssId="__Card__:0"
      >
        <text>
          <raw-text
            text="hey"
          />
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
  await waitSchedule();
  const callLepusMethod =
    lynxDOM.backgroundThread.lynx.getNativeApp().callLepusMethod;
  expect(callLepusMethod.mock.calls).toMatchInlineSnapshot(`
    [
      [
        "rLynxChange",
        {
          "data": "{"snapshotPatch":[3,2,0,1]}",
          "patchOptions": {
            "commitTaskId": 10,
            "pipelineOptions": {
              "needTimestamps": true,
              "pipelineID": "pipelineID",
            },
            "reloadVersion": 0,
          },
        },
        [Function],
      ],
      [
        "rLynxChange",
        {
          "data": "{"snapshotPatch":[3,2,0,1]}",
          "patchOptions": {
            "commitTaskId": 11,
            "pipelineOptions": {
              "needTimestamps": true,
              "pipelineID": "pipelineID",
            },
            "reloadVersion": 0,
          },
        },
        [Function],
      ],
    ]
  `);

  await findByText('1');

  vi.clearAllMocks();
});
