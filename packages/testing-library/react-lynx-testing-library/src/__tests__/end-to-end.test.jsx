import '@lynx-js/lynx-dom-jest-matchers';
import { Component, h } from 'preact';
import { expect } from 'vitest';
import { render, getScreen, waitForElementToBeRemoved } from '..';
import { snapshotInstanceManager } from '@lynx-js/react/runtime/lib/snapshot.js';

const fetchAMessage = () =>
  new Promise((resolve) => {
    // we are using random timeout here to simulate a real-time example
    // of an async operation calling a callback at a non-deterministic time
    const randomTimeout = Math.floor(Math.random() * 100);

    setTimeout(() => {
      resolve({ returnedMessage: 'Hello World' });
    }, randomTimeout);
  });

class ComponentWithLoader extends Component {
  state = { loading: true };

  componentDidMount() {
    fetchAMessage().then(data => {
      this.setState({ data, loading: false });
    });
  }

  render() {
    if (this.state.loading) {
      return <text>Loading...</text>;
    }

    return (
      <text data-testid='message'>
        Loaded this message: {this.state.data.returnedMessage}!
      </text>
    );
  }
}

test('state change will cause re-render', async () => {
  vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
  expect(snapshotInstanceManager.values).toMatchInlineSnapshot(`
    Map {
      -1 => {
        "children": undefined,
        "id": -1,
        "type": "root",
        "values": undefined,
      },
    }
  `);
  expect(snapshotInstanceManager.nextId).toMatchInlineSnapshot(`-1`);
  render(<ComponentWithLoader />);
  expect(elementTree.root).toMatchInlineSnapshot(`
    <page
      cssId="__Card__:0"
    >
      <text>
        <raw-text
          text="Loading..."
        />
      </text>
    </page>
  `);
  expect(snapshotInstanceManager.values).toMatchInlineSnapshot(`
    Map {
      -1 => {
        "children": [
          {
            "children": undefined,
            "id": 2,
            "type": "__Card__:__snapshot_f46c5_test_1",
            "values": undefined,
          },
        ],
        "id": -1,
        "type": "root",
        "values": undefined,
      },
      2 => {
        "children": undefined,
        "id": 2,
        "type": "__Card__:__snapshot_f46c5_test_1",
        "values": undefined,
      },
    }
  `);

  await new Promise(resolve => {
    setTimeout(resolve, 1000);
  });

  const isBackground = !__LEPUS__;

  const callLepusMethod =
    lynxDOM.backgroundThread.lynx.getNativeApp().callLepusMethod;
  // callLepusMethodCalls such as rLynxChange
  globalThis.lynxDOM.switchToMainThread();
  expect(callLepusMethod.mock.calls).toMatchInlineSnapshot(`
    [
      [
        "rLynxChange",
        {
          "data": "{"snapshotPatch":[0,"__Card__:__snapshot_f46c5_test_1",2,1,-1,2,null]}",
          "patchOptions": {
            "commitTaskId": 2,
            "isHydration": true,
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
          "data": "{"snapshotPatch":[2,-1,2,0,"__Card__:__snapshot_f46c5_test_2",3,0,null,4,3,4,0,"Hello World",1,3,4,null,1,-1,3,null]}",
          "patchOptions": {
            "commitTaskId": 3,
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

  // restore the original thread state
  if (isBackground) {
    globalThis.lynxDOM.switchToBackgroundThread();
  }

  expect(elementTree.root).toMatchInlineSnapshot(`
    <page
      cssId="__Card__:0"
    >
      <text
        dataset={
          {
            "testid": "message",
          }
        }
      >
        <raw-text
          text="Loaded this message: "
        />
        <wrapper>
          <raw-text
            text="Hello World"
          />
        </wrapper>
        <raw-text
          text="!"
        />
      </text>
    </page>
  `);
});

test('it waits for the data to be loaded', async () => {
  expect(snapshotInstanceManager.values).toMatchInlineSnapshot(`
    Map {
      -1 => {
        "children": undefined,
        "id": -1,
        "type": "root",
        "values": undefined,
      },
    }
  `);
  expect(snapshotInstanceManager.nextId).toMatchInlineSnapshot(`-1`);
  render(<ComponentWithLoader />);
  expect(elementTree.root).toMatchInlineSnapshot(`
    <page
      cssId="__Card__:0"
    >
      <text>
        <raw-text
          text="Loading..."
        />
      </text>
    </page>
  `);
  const screen = getScreen();
  const loading = () => {
    return screen.getByText('Loading...');
  };
  await waitForElementToBeRemoved(loading);
  expect(screen.getByTestId('message')).toHaveTextContent(/Hello World/);
  expect(elementTree.root).toMatchInlineSnapshot(`
    <page
      cssId="__Card__:0"
    >
      <text
        dataset={
          {
            "testid": "message",
          }
        }
      >
        <raw-text
          text="Loaded this message: "
        />
        <wrapper>
          <raw-text
            text="Hello World"
          />
        </wrapper>
        <raw-text
          text="!"
        />
      </text>
    </page>
  `);
});
