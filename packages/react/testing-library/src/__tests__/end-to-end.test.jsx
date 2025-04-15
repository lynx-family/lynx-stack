import '@testing-library/jest-dom';
import { Component } from 'preact';
import { expect } from 'vitest';
import { render, screen, waitForElementToBeRemoved } from '..';
import { snapshotInstanceManager } from '../../../runtime/lib/snapshot.js';

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
    <page>
      <text>
        Loading...
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
            "type": "__Card__:__snapshot_354a3_test_1",
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
        "type": "__Card__:__snapshot_354a3_test_1",
        "values": undefined,
      },
    }
  `);

  await new Promise(resolve => {
    setTimeout(resolve, 1000);
  });

  const isBackground = !__MAIN_THREAD__;

  const callLepusMethod = lynxEnv.backgroundThread.lynx.getNativeApp().callLepusMethod;
  // callLepusMethodCalls such as rLynxChange
  globalThis.lynxEnv.switchToMainThread();
  expect(callLepusMethod.mock.calls).toMatchInlineSnapshot(`
    [
      [
        "rLynxChange",
        {
          "data": "{"patchList":[{"snapshotPatch":[0,"__Card__:__snapshot_354a3_test_1",2,1,-1,2,null],"id":2}]}",
          "patchOptions": {
            "isHydration": true,
            "pipelineOptions": {
              "dsl": "reactLynx",
              "needTimestamps": true,
              "pipelineID": "pipelineID",
              "pipelineOrigin": "reactLynxHydrate",
              "stage": "hydrate",
            },
            "reloadVersion": 0,
          },
        },
        [Function],
      ],
      [
        "rLynxChange",
        {
          "data": "{"patchList":[{"id":3,"snapshotPatch":[2,-1,2,0,"__Card__:__snapshot_354a3_test_2",3,0,null,4,3,4,0,"Hello World",1,3,4,null,1,-1,3,null]}]}",
          "patchOptions": {
            "pipelineOptions": {
              "dsl": "reactLynx",
              "needTimestamps": true,
              "pipelineID": "pipelineID",
              "pipelineOrigin": "reactLynxHydrate",
              "stage": "hydrate",
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
    globalThis.lynxEnv.switchToBackgroundThread();
  }

  expect(elementTree.root).toMatchInlineSnapshot(`
    <page>
      <text
        data-testid="message"
      >
        Loaded this message: 
        <wrapper>
          Hello World
        </wrapper>
        !
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
    <page>
      <text>
        Loading...
      </text>
    </page>
  `);
  const loading = () => {
    return screen.getByText('Loading...');
  };
  await waitForElementToBeRemoved(loading);
  expect(document.body).toMatchInlineSnapshot(`
    <body>
      <page>
        <text
          data-testid="message"
        >
          Loaded this message: 
          <wrapper>
            Hello World
          </wrapper>
          !
        </text>
      </page>
    </body>
  `);
  expect(screen.getByTestId('message')).toHaveTextContent(/Hello World/);
  expect(elementTree.root).toMatchInlineSnapshot(`
    <page>
      <text
        data-testid="message"
      >
        Loaded this message: 
        <wrapper>
          Hello World
        </wrapper>
        !
      </text>
    </page>
  `);
});
