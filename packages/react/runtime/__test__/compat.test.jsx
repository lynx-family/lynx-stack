import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { elementTree } from './utils/nativeMethod';
import {
  backgroundSnapshotInstanceManager,
  setupPage,
  SnapshotInstance,
  snapshotInstanceManager,
} from '../src/snapshot';
import { ComponentFromReactRuntime, wrapWithLynxComponent } from '../src/compat/lynxComponent';
import { Fragment, options, render } from 'preact';
import { globalEnvManager } from './utils/envManager';

const HOLE = null;

let scratch;

beforeAll(() => {
  globalEnvManager.switchToMainThread();
  setupPage(__CreatePage('0', 0));
});

beforeEach(() => {
  backgroundSnapshotInstanceManager.clear();
  backgroundSnapshotInstanceManager.nextId = 0;
  snapshotInstanceManager.clear();
  snapshotInstanceManager.nextId = 0;
  scratch = new SnapshotInstance('root');
});

afterEach(() => {
  render(null, scratch);
  elementTree.clear();
});

describe('addComponentElement', () => {
  it('should render a fake component element \'view\'', () => {
    class C extends ComponentFromReactRuntime {
      render() {
        return <view />;
      }
    }

    const jsx = wrapWithLynxComponent((__c) => <view>{__c}</view>, <C />);

    scratch.ensureElements();
    render(jsx, scratch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <view />
        </view>
      </page>
    `);
  });

  let snapshot = (__c) => <view id='1' className='2' style='flex: 3'>{__c}</view>;
  it('should render a fake component element \'view\' - with some component attr', () => {
    class C extends ComponentFromReactRuntime {
      render() {
        return <view />;
      }
    }

    const jsx = wrapWithLynxComponent(snapshot, <C />);

    scratch.ensureElements();
    render(jsx, scratch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="2"
          id="1"
          style="flex: 3"
        >
          <view />
        </view>
      </page>
    `);
  });

  let snapshotSpread = (__c, __spread) => <view {...__spread}>{__c}</view>;
  it('should render a fake component element \'view\' - with some component attr and spread', () => {
    class C extends ComponentFromReactRuntime {
      render() {
        return <view />;
      }
    }

    const jsx = wrapWithLynxComponent(
      snapshotSpread,
      <C id='1' className='2' style='flex: 3' bindtap={vi.fn()} data-a='1' />,
    );

    scratch.ensureElements();
    render(jsx, scratch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="2"
          dataset={
            {
              "a": "1",
            }
          }
          event={
            {
              "bindEvent:tap": "-2:0:bindtap",
            }
          }
          id="1"
          style="flex: 3"
        >
          <view />
        </view>
      </page>
    `);
  });

  it('should not render a fake component element \'view\' when component is not from legacy-react-runtime', () => {
    const jsx = wrapWithLynxComponent(snapshot, <Fragment />);

    scratch.ensureElements();
    render(jsx, scratch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      />
    `);
  });

  it('should not render a fake component element \'view\' when there is removeComponentElement={true}', () => {
    class C extends ComponentFromReactRuntime {
      render() {
        return <view />;
      }
    }
    const jsx = wrapWithLynxComponent(
      snapshotSpread,
      <C id='1' className='2' style='flex: 3' bindtap={vi.fn()} data-a='1' removeComponentElement={true} />,
    );

    scratch.ensureElements();
    render(jsx, scratch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view />
      </page>
    `);
  });

  it('should render a fake component element \'view\' when there is removeComponentElement={false}', () => {
    class C extends ComponentFromReactRuntime {
      render() {
        return <view />;
      }
    }
    const jsx = wrapWithLynxComponent(
      snapshotSpread,
      <C id='1' className='2' style='flex: 3' bindtap={vi.fn()} data-a='1' removeComponentElement={false} />,
    );

    scratch.ensureElements();
    render(jsx, scratch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="2"
          dataset={
            {
              "a": "1",
            }
          }
          event={
            {
              "bindEvent:tap": "-2:0:bindtap",
            }
          }
          id="1"
          removeComponentElement={false}
          style="flex: 3"
        >
          <view />
        </view>
      </page>
    `);
  });
});
