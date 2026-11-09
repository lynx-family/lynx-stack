// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { expect, it } from 'vitest';

import { useState } from '../../../src/index';
import { createBackgroundRenderer, createMainThreadRenderer } from '../../../src/internal';
import { globalEnvManager } from '../utils/envManager';
import { elementTree, waitSchedule } from '../utils/nativeMethod';

it('hydrates two roots, routes a native tap and preserves isolated state across props updates', async () => {
  globalEnvManager.resetEnv();
  function Counter({ label }) {
    const [count, setCount] = useState(0);
    return <text bindtap={() => setCount(value => value + 1)}>{`${label}:${count}`}</text>;
  }
  const main = createMainThreadRenderer();
  const page = main.initialize({});
  const hosts = ['a', 'b'].map(() => {
    const host = __CreateElement('view', page.id);
    __AppendElement(page.element, host);
    return host;
  });
  const mainRoots = hosts.map(host => main.createRoot(host));
  const frames = mainRoots.map((root, index) => root.render(<Counter label={index === 0 ? 'a' : 'b'} />));
  const text = host => host.children[0].children[0].props.text;
  expect(hosts.map(text)).toEqual(['a:0', 'b:0']);

  globalEnvManager.switchToBackground();
  const background = createBackgroundRenderer();
  const packets = [[], []];
  const roots = packets.map(queue =>
    background.createRoot((patchList, patchOptions, finish) => {
      queue.push({ patchList, patchOptions, finish });
    })
  );
  const apply = ({ patchList, patchOptions, finish }) => {
    globalEnvManager.switchToMainThread();
    main.applyCommit({ data: JSON.stringify(patchList), patchOptions });
    globalEnvManager.switchToBackground();
    finish();
  };
  try {
    roots.forEach((root, index) => {
      root.render(<Counter label={index === 0 ? 'a' : 'b'} />);
      packets[index].splice(0).forEach(packet => packet.finish());
      apply({
        patchList: root.hydrate(frames[index]),
        patchOptions: { reloadVersion: 0, isHydration: true },
        finish() {},
      });
    });
    background.flushEvents();
    expect(hosts.map(text)).toEqual(['a:0', 'b:0']);

    const handler = hosts[0].children[0].props.event['bindEvent:tap'];
    lynx.getApp().publishEvent(handler, { type: 'tap' });
    await waitSchedule();
    expect(packets[0]).toHaveLength(1);
    expect(packets[1]).toHaveLength(0);
    apply(packets[0].shift());
    expect(hosts.map(text)).toEqual(['a:1', 'b:0']);
    expect(background.getCurrentRoot()).toBe(roots[0]);

    roots[0].render(<Counter label='updated' />);
    apply(packets[0].shift());
    expect(hosts.map(text)).toEqual(['updated:1', 'b:0']);

    roots[0].destroy();
    globalEnvManager.switchToMainThread();
    mainRoots[0].destroy();
    expect(hosts[0].children).toHaveLength(0);
    expect(text(hosts[1])).toBe('b:0');
    globalEnvManager.switchToBackground();
    roots[1].destroy();
    globalEnvManager.switchToMainThread();
    mainRoots[1].destroy();
    expect(page.element.children).toEqual(hosts);
  } finally {
    globalEnvManager.switchToBackground();
    packets.flat().forEach(packet => packet.finish());
    background.dispose();
    globalEnvManager.resetEnv();
    elementTree.clear();
  }
});
