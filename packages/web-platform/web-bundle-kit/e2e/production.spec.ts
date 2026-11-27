// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// A production build of the fixture, rendered in <lynx-view>.

import {
  PUBLIC_PATH,
  bytes,
  entries,
  expect,
  readFixture,
  test,
} from './harness.js';

test('production build renders in <lynx-view>', async ({ kitPage }) => {
  const { kit, page, serve, timing } = kitPage;

  await test.step('production build()', async () => {
    const createStart = Date.now();
    const created = await kit('create', {
      entries,
      publicPath: PUBLIC_PATH,
      mode: 'production',
      files: readFixture(),
    });
    // The first create() loads Rspack's wasm and the mirror.
    timing('first create()', Date.now() - createStart);
    expect(created.builtinPackages['@lynx-js/react']).toBeDefined();
    const start = Date.now();
    const prod = await kit('build');
    timing('production build', Date.now() - start);
    timing('production build in Rspack', prod.durationMs);
    expect(prod.errors, JSON.stringify(prod.errors, null, 2)).toEqual([]);
    expect(prod.cards).toEqual([
      { name: 'main', entry: 'src/main/index.tsx', bundle: 'main.web.bundle' },
      {
        name: 'detail',
        entry: 'src/detail/index.tsx',
        bundle: 'detail.web.bundle',
      },
    ]);
    const names = prod.assets.map(a => a.name);
    expect(names).toContain('main.web.bundle');
    expect(names).toContain('detail.web.bundle');
    expect(
      names.some(n => n.endsWith('.png')),
      `an image asset: ${names.join(', ')}`,
    ).toBe(true);
    expect(prod.emitted).toHaveLength(prod.assets.length);
    for (const asset of prod.assets) {
      const emitted = prod.emitted.find(e => e.name === asset.name);
      expect(emitted, asset.name).toBeDefined();
      expect(bytes(emitted!.content).length, asset.name).toBe(asset.size);
    }
    serve(prod);
  });

  await test.step('production bundle renders in <lynx-view>', async () => {
    await page.evaluate(
      url => window.render(url),
      `${PUBLIC_PATH}main.web.bundle`,
    );
    const handle = await page.waitForFunction(
      () => {
        const root = document.querySelector('lynx-view')?.shadowRoot;
        if (!root) return false;
        const all = [...root.querySelectorAll('*')];
        const title = all.find(el =>
          el.textContent?.trim() === 'Hello from the web bundle kit'
          && el.children.length === 0
        );
        const badge = all.find(el =>
          el.textContent?.trim() === 'css module' && el.children.length === 0
        );
        const image = all.find(el =>
          el.tagName.toLowerCase().includes('image')
        );
        if (!title || !badge) return false;
        const owner = (el: Element) =>
          el.closest('x-text') ?? el.parentElement ?? el;
        return {
          title: getComputedStyle(owner(title)).color,
          titleSize: getComputedStyle(owner(title)).fontSize,
          badge: getComputedStyle(owner(badge)).color,
          image: image ? image.getAttribute('src') : null,
        };
      },
      null,
      { timeout: 30_000 },
    );
    const styles = await handle.jsonValue();
    if (!styles) throw new Error('the card has no title');
    expect(styles.title, JSON.stringify(styles)).toBe('rgb(255, 0, 0)');
    expect(styles.badge, JSON.stringify(styles)).toBe('rgb(0, 128, 0)');
    expect(
      styles.image?.startsWith(PUBLIC_PATH) && styles.image.endsWith('.png'),
      JSON.stringify(styles),
    ).toBe(true);
  });
});
