import { SimpleStyleSheet } from '@lynx-js/react';
import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { globalEnvManager } from '../utils/envManager';
import { initDelayUnmount } from '../../src/lifecycle/delayUnmount';
import { globalCommitTaskMap, replaceCommitHook } from '../../src/lifecycle/patch/commit';
import { deinitGlobalSnapshotPatch } from '../../src/lifecycle/patch/snapshotPatch';
import { __root } from '../../src/root';
import { setupPage } from '../../src/snapshot';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  replaceCommitHook();
  initDelayUnmount();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  globalCommitTaskMap.clear();
  globalEnvManager.resetEnv();
  deinitGlobalSnapshotPatch();
  vi.restoreAllMocks();
});

const styles = SimpleStyleSheet.create({
  main: {
    width: '100px',
    height: '100px',
  },
  active: {
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'red',
  },
  withColor: (color) => ({
    backgroundColor: color,
  }),
});

function ComponentWithSimpleStyle({
  color,
  isActive,
}) {
  return (
    <view
      simpleStyle={[
        styles.main,
        isActive && styles.active,
        styles.withColor(color),
      ]}
    />
  );
}

describe('simple styling', () => {
  it('Using SimpleStyleSheet.create directly should throw error', () => {
    globalThis.__DEV__ = false;
    const { create } = SimpleStyleSheet;
    expect(create).toThrowErrorMatchingInlineSnapshot(
      `[Error: \`SimpleStyleSheet.create\` is only supported in Simple Styling mode, please enable Simple Styling by set \`enableSimpleStyling: true\` in pluginReactLynx]`,
    );
    globalThis.__DEV__ = true;
    const sheet = {
      main: {
        width: '100px',
      },
    };
    expect(create(sheet)).toBe(sheet);
  });

  it('basic', async function() {
    globalEnvManager.switchToMainThread();
    __root.__jsx = <ComponentWithSimpleStyle color='red' isActive={true} />;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          simpleStyle={
            {
              "7": "red",
              "border-bottom-color": "red",
              "border-bottom-style": "solid",
              "border-bottom-width": "1px",
              "height": "100px",
              "width": "100px",
            }
          }
          styleObjectList={
            [
              "db4cf10",
              "356935a",
              "e734863",
              "b692b3c",
              "81b9601",
              "100000000",
            ]
          }
        />
      </page>
    `);

    globalEnvManager.switchToBackground();
    render(<ComponentWithSimpleStyle color='red' isActive={false} />, __root);

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
      lynx.getNativeApp().callLepusMethod.mockClear();
    }

    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          simpleStyle={
            {
              "7": "red",
              "height": "100px",
              "width": "100px",
            }
          }
          styleObjectList={
            [
              "db4cf10",
              "356935a",
              false,
              "100000001",
            ]
          }
        />
      </page>
    `);
  });
});
