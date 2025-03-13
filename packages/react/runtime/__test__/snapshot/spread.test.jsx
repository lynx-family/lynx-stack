/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { hydrate } from '../../src/backgroundSnapshot';
import { useState } from '../../src/index';
import { initGlobalSnapshotPatch, takeGlobalSnapshotPatch } from '../../src/lifecycle/patch/snapshotPatch';
import { snapshotPatchApply } from '../../src/lifecycle/patch/snapshotPatchApply';
import { backgroundSnapshotInstanceManager, setupPage, snapshotInstanceManager } from '../../src/snapshot';
import { globalEnvManager } from '../utils/envManager';
import { elementTree } from '../utils/nativeMethod';

let scratch;
let scratchBackground;

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
});

beforeEach(() => {
  globalEnvManager.switchToMainThread();
  scratch = document.createElement('root');
  scratch.ensureElements();
  globalEnvManager.switchToBackground();
  scratchBackground = document.createElement('root');
});

afterEach(() => {
  vi.restoreAllMocks();

  globalEnvManager.switchToMainThread();
  render(null, scratch);
  globalEnvManager.switchToBackground();
  render(null, scratchBackground);

  elementTree.clear();
  backgroundSnapshotInstanceManager.clear();
  backgroundSnapshotInstanceManager.nextId = 0;
  snapshotInstanceManager.clear();
  snapshotInstanceManager.nextId = 0;
});

describe('spreadUpdate', () => {
  it('basic', async function() {
    function Comp() {
      const [spread, setSpread] = useState({
        id: 'id_str',
        className: 'className_str',
        style: 'style_str',
        name: 'name_str',
        class: 'class_str',
      });
      return (
        <view>
          <text {...spread} data-outside={'outside'}>1</text>
        </view>
      );
    }

    globalEnvManager.switchToMainThread();
    render(<Comp />, scratch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text
            class="class_str"
            dataset={
              {
                "outside": "outside",
              }
            }
            flatten={false}
            id="id_str"
            name="name_str"
            style="style_str"
          >
            <raw-text
              text="1"
            />
          </text>
        </view>
      </page>
    `);
  });

  it('insert', async function() {
    let patch;
    let setSpread_;
    function Comp() {
      const [spread, setSpread] = useState({});
      setSpread_ = setSpread;
      return (
        <view>
          <text {...spread}>1</text>
        </view>
      );
    }

    globalEnvManager.switchToMainThread();
    render(<Comp />, scratch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text>
            <raw-text
              text="1"
            />
          </text>
        </view>
      </page>
    `);
    globalEnvManager.switchToBackground();
    render(<Comp />, scratchBackground);
    patch = hydrate(JSON.parse(JSON.stringify(scratch)), scratchBackground);
    globalEnvManager.switchToMainThread();
    snapshotPatchApply(patch);
    globalEnvManager.switchToBackground();
    initGlobalSnapshotPatch();

    setSpread_({
      id: 'id_str',
      className: undefined,
      style: 'style_str',
      'data-a': 'a-a-a',
    });
    render(<Comp />, scratchBackground);
    patch = takeGlobalSnapshotPatch();
    expect(patch).toMatchInlineSnapshot(`
      [
        3,
        -2,
        0,
        {
          "className": "",
          "data-a": "a-a-a",
          "id": "id_str",
          "style": "style_str",
        },
      ]
    `);

    globalEnvManager.switchToMainThread();
    snapshotPatchApply(patch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text
            class=""
            dataset={
              {
                "a": "a-a-a",
              }
            }
            id="id_str"
            style="style_str"
          >
            <raw-text
              text="1"
            />
          </text>
        </view>
      </page>
    `);
  });

  it('update', async function() {
    let patch;
    let setSpread_;
    function Comp() {
      const [spread, setSpread] = useState({
        id: 'id_str',
        className: 'class_str',
        style: 'style_str',
        'data-a': 'a-a-a',
        'data-c': 'c-c-c',
        autoplay: false,
      });
      setSpread_ = setSpread;
      return (
        <view>
          <text {...spread}>1</text>
        </view>
      );
    }

    globalEnvManager.switchToMainThread();
    render(<Comp />, scratch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text
            autoplay={false}
            class="class_str"
            dataset={
              {
                "a": "a-a-a",
                "c": "c-c-c",
              }
            }
            id="id_str"
            style="style_str"
          >
            <raw-text
              text="1"
            />
          </text>
        </view>
      </page>
    `);
    globalEnvManager.switchToBackground();
    render(<Comp />, scratchBackground);
    patch = hydrate(JSON.parse(JSON.stringify(scratch)), scratchBackground);
    // this update could be removed later
    expect(patch).toMatchInlineSnapshot(`[]`);
    globalEnvManager.switchToMainThread();
    snapshotPatchApply(patch);
    globalEnvManager.switchToBackground();
    initGlobalSnapshotPatch();
    setSpread_({
      id: 'id_str_2',
      'data-b': 'b-b-b',
      'data-c': 'c-c-c',
      autoplay: true,
    });
    render(<Comp />, scratchBackground);
    patch = takeGlobalSnapshotPatch();
    expect(patch).toMatchInlineSnapshot(`
      [
        3,
        -2,
        0,
        {
          "autoplay": true,
          "data-b": "b-b-b",
          "data-c": "c-c-c",
          "id": "id_str_2",
        },
      ]
    `);

    globalEnvManager.switchToMainThread();
    snapshotPatchApply(patch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text
            autoplay={true}
            class=""
            dataset={
              {
                "b": "b-b-b",
                "c": "c-c-c",
              }
            }
            id="id_str_2"
            style=""
          >
            <raw-text
              text="1"
            />
          </text>
        </view>
      </page>
    `);
  });

  it('remove', async function() {
    let patch;
    let setSpread_;
    function Comp() {
      const [spread, setSpread] = useState({
        id: 'id_str',
        className: 'class_str',
        style: 'style_str',
        'data-a': 'a-a-a',
        autoplay: false,
      });
      setSpread_ = setSpread;
      return (
        <view>
          <text {...spread}>1</text>
        </view>
      );
    }

    globalEnvManager.switchToMainThread();
    render(<Comp />, scratch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text
            autoplay={false}
            class="class_str"
            dataset={
              {
                "a": "a-a-a",
              }
            }
            id="id_str"
            style="style_str"
          >
            <raw-text
              text="1"
            />
          </text>
        </view>
      </page>
    `);
    globalEnvManager.switchToBackground();
    render(<Comp />, scratchBackground);
    patch = hydrate(JSON.parse(JSON.stringify(scratch)), scratchBackground);
    // this update could be removed later
    expect(patch).toMatchInlineSnapshot(`[]`);
    globalEnvManager.switchToMainThread();
    snapshotPatchApply(patch);
    globalEnvManager.switchToBackground();
    initGlobalSnapshotPatch();
    setSpread_({});
    render(<Comp />, scratchBackground);
    patch = takeGlobalSnapshotPatch();
    expect(patch).toMatchInlineSnapshot(`
      [
        3,
        -2,
        0,
        {},
      ]
    `);

    globalEnvManager.switchToMainThread();
    snapshotPatchApply(patch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text
            class=""
            dataset={{}}
            id={null}
            style=""
          >
            <raw-text
              text="1"
            />
          </text>
        </view>
      </page>
    `);
  });

  it('remove - null spread', async function() {
    let patch;
    let setSpread_;
    function Comp() {
      const [spread, setSpread] = useState({
        id: 'id_str',
        className: 'class_str',
        style: 'style_str',
        'data-a': 'a-a-a',
      });
      setSpread_ = setSpread;
      return (
        <view>
          <text {...spread}>1</text>
        </view>
      );
    }

    globalEnvManager.switchToMainThread();
    render(<Comp />, scratch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text
            class="class_str"
            dataset={
              {
                "a": "a-a-a",
              }
            }
            id="id_str"
            style="style_str"
          >
            <raw-text
              text="1"
            />
          </text>
        </view>
      </page>
    `);
    globalEnvManager.switchToBackground();
    render(<Comp />, scratchBackground);
    patch = hydrate(JSON.parse(JSON.stringify(scratch)), scratchBackground);
    // this update could be removed later
    expect(patch).toMatchInlineSnapshot(`[]`);
    globalEnvManager.switchToMainThread();
    snapshotPatchApply(patch);
    globalEnvManager.switchToBackground();
    initGlobalSnapshotPatch();
    setSpread_(null);
    render(<Comp />, scratchBackground);
    patch = takeGlobalSnapshotPatch();
    expect(patch).toMatchInlineSnapshot(`
      [
        3,
        -2,
        0,
        {},
      ]
    `);

    globalEnvManager.switchToMainThread();
    snapshotPatchApply(patch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text
            class=""
            dataset={{}}
            id={null}
            style=""
          >
            <raw-text
              text="1"
            />
          </text>
        </view>
      </page>
    `);
  });

  it('multiple spreads', async function() {
    let patch;
    let setSpread_;
    let setSpread2_;
    function Comp() {
      const [spread, setSpread] = useState({
        id: 'id_str',
        className: 'class_str',
        style: 'style_str',
        'data-a': 'a-a-a',
      });
      const [spread2, setSpread2] = useState({
        id: 'id_str_2',
        className: 'class_str_2',
        style: 'style_str_2',
        'data-x': 'x-x-x',
      });
      setSpread_ = setSpread;
      setSpread2_ = setSpread2;
      return (
        <view>
          <text {...spread}>1</text>
          <text {...spread}>2</text>
          <text {...spread2}>3</text>
        </view>
      );
    }

    globalEnvManager.switchToMainThread();
    render(<Comp />, scratch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text
            class="class_str"
            dataset={
              {
                "a": "a-a-a",
              }
            }
            id="id_str"
            style="style_str"
          >
            <raw-text
              text="1"
            />
          </text>
          <text
            class="class_str"
            dataset={
              {
                "a": "a-a-a",
              }
            }
            id="id_str"
            style="style_str"
          >
            <raw-text
              text="2"
            />
          </text>
          <text
            class="class_str_2"
            dataset={
              {
                "x": "x-x-x",
              }
            }
            id="id_str_2"
            style="style_str_2"
          >
            <raw-text
              text="3"
            />
          </text>
        </view>
      </page>
    `);
    globalEnvManager.switchToBackground();
    render(<Comp />, scratchBackground);
    patch = hydrate(JSON.parse(JSON.stringify(scratch)), scratchBackground);
    // this update could be removed later
    expect(patch).toMatchInlineSnapshot(`[]`);
    globalEnvManager.switchToMainThread();
    snapshotPatchApply(patch);
    globalEnvManager.switchToBackground();
    initGlobalSnapshotPatch();
    setSpread_({});
    render(<Comp />, scratchBackground);
    patch = takeGlobalSnapshotPatch();
    expect(patch).toMatchInlineSnapshot(`
      [
        3,
        -2,
        0,
        {},
        3,
        -2,
        1,
        {},
      ]
    `);

    globalEnvManager.switchToMainThread();
    snapshotPatchApply(patch);
    expect(scratch.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text
            class=""
            dataset={{}}
            id={null}
            style=""
          >
            <raw-text
              text="1"
            />
          </text>
          <text
            class=""
            dataset={{}}
            id={null}
            style=""
          >
            <raw-text
              text="2"
            />
          </text>
          <text
            class="class_str_2"
            dataset={
              {
                "x": "x-x-x",
              }
            }
            id="id_str_2"
            style="style_str_2"
          >
            <raw-text
              text="3"
            />
          </text>
        </view>
      </page>
    `);
  });
});
