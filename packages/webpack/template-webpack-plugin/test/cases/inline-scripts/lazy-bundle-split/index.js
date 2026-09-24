/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
/// <reference types="@rstest/core/globals" />

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

it('should load the lazy bundle', async () => {
  const { component } = await import(
    /* webpackChunkName: 'component:background' */
    './component.js'
  );
  expect(component()).toBe('shared:component');
});

// Regression test: with bundle splitting enabled, a lazy bundle's background is
// split into multiple chunks (here `shared` + `component`). A user-provided
// `inlineScripts` regex that is meant to match `background.js` does not match
// these chunk names. Previously every background chunk that failed the matcher
// was externalized via `lynx.requireModuleAsync`, leaving the modules
// unavailable when `installChunk` runs synchronously and breaking the bundle.
// All background chunks of a lazy bundle must be inlined.
it('inlines every split background chunk of a lazy bundle', async () => {
  // The entry is emitted into `.rspeedy/main/`, like a real build.
  const tasmJSONPath = resolve(
    __dirname,
    '../lazy-bundle/component/tasm.json',
  );
  expect(existsSync(tasmJSONPath)).toBeTruthy();

  const content = await readFile(tasmJSONPath, 'utf-8');
  const { sourceContent, manifest } = JSON.parse(content);

  expect(sourceContent).toHaveProperty('appType', 'DynamicComponent');

  // Both split background chunks are inlined into the bundle.
  const keys = Object.keys(manifest);
  expect(keys).toContain('/app-service.js');
  const backgroundChunks = keys.filter(key =>
    key.startsWith('/.rspeedy/lazy-bundle/component/background.')
  );
  expect(backgroundChunks).toHaveLength(2);

  // They are required synchronously, not via requireModuleAsync.
  for (const chunk of backgroundChunks) {
    expect(manifest['/app-service.js']).toContain(
      `lynx.requireModule(\"${chunk}\"`,
    );
  }
  expect(manifest['/app-service.js']).not.toContain('requireModuleAsync');

  // the inlined app-service should be valid JavaScript
  expect(() => eval(manifest['/app-service.js'])).not.toThrow();
});
