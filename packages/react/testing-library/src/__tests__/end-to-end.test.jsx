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
        "extraProps": undefined,
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
            "extraProps": undefined,
            "id": 2,
            "type": "__snapshot_354a3_test_1",
            "values": undefined,
          },
        ],
        "extraProps": undefined,
        "id": -1,
        "type": "root",
        "values": undefined,
      },
      2 => {
        "children": undefined,
        "extraProps": undefined,
        "id": 2,
        "type": "__snapshot_354a3_test_1",
        "values": undefined,
      },
    }
  `);

  await new Promise(resolve => {
    setTimeout(resolve, 1000);
  });

  const isBackground = !__MAIN_THREAD__;

  const callLepusMethod = lynxTestingEnv.backgroundThread.lynx.getNativeApp().callLepusMethod;
  // callLepusMethodCalls such as rLynxChange
  globalThis.lynxTestingEnv.switchToMainThread();
  expect(callLepusMethod.mock.calls).toMatchInlineSnapshot(`
    [
      [
        "rLynxChange",
        {
          "data": "{"patchList":[{"snapshotPatch":[0,"__snapshot_354a3_test_1",2,1,-1,2,null],"id":2}]}",
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
          "data": "{"patchList":[{"id":3,"snapshotPatch":[2,-1,2,100,"__snapshot_354a3_test_2","function() {\\n  const pageId = __vite_ssr_import_1__.__pageId;\\n  const el = __CreateText(pageId);\\n  __AddDataset(el, \\"testid\\", \\"message\\");\\n  const el1 = __CreateRawText(\\"Loaded this message: \\");\\n  __AppendElement(el, el1);\\n  const el2 = __CreateWrapperElement(pageId);\\n  __AppendElement(el, el2);\\n  const el3 = __CreateRawText(\\"!\\");\\n  __AppendElement(el, el3);\\n  return [\\n    el,\\n    el1,\\n    el2,\\n    el3\\n  ];\\n}",[],[[3,2]],null,"__Card__",0,"__snapshot_354a3_test_2",3,0,null,4,3,4,0,"Hello World",1,3,4,null,1,-1,3,null]}]}",
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
    globalThis.lynxTestingEnv.switchToBackgroundThread();
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
        "extraProps": undefined,
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
  await waitForElementToBeRemoved(loading, { timeout: 50_000 });
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
