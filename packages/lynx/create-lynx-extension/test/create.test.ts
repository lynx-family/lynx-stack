// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createLynxExtension, parseExtensionTypes } from '../src/index.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});

describe('create-lynx-extension', () => {
  it('parses non-interactive extension type flags', () => {
    expect(parseExtensionTypes('native-module,element,service')).toEqual([
      'native-module',
      'element',
      'service',
    ]);
    expect(() => parseExtensionTypes('web')).toThrow(
      /Unsupported extension type/,
    );
  });

  it('creates a mixed Native Autolink extension', () => {
    const dir = createTempDir('mixed');
    const files = createLynxExtension({
      dir,
      types: ['native-module', 'element', 'service'],
      packageName: '@example/lynx-button',
      androidPackage: 'com.example.button',
      moduleName: 'ButtonModule',
      elementName: 'x-button',
      serviceName: 'ButtonService',
    });

    expect(files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        'package.json',
        'lynx.ext.json',
        'types/index.d.ts',
        'src/index.ts',
        'android/src/main/java/com/example/button/ButtonModule.java',
        'android/src/main/java/com/example/button/ButtonElement.java',
        'android/src/main/java/com/example/button/ButtonService.java',
        'ios/src/ButtonModule.h',
        'ios/src/ButtonElement.h',
        'ios/src/ButtonElement.m',
        'ios/src/ButtonService.h',
        'ios/src/ButtonService.m',
        'example/src/App.tsx',
      ]),
    );

    expect(read(dir, 'package.json')).toContain(
      '"codegen": "lynx-autolink-codegen"',
    );
    expect(read(dir, 'package.json')).toContain(
      '"@lynx-js/autolink-codegen": "^0.0.0"',
    );
    expect(read(dir, 'lynx.ext.json')).toContain(
      '"packageName": "com.example.button"',
    );
    expect(read(dir, 'types/index.d.ts')).toContain('/** @lynxmodule */');
    expect(read(dir, 'types/index.d.ts')).toContain(
      'setValue(key: string, value: string): void;',
    );
    expect(
      read(dir, 'android/src/main/java/com/example/button/ButtonModule.java'),
    ).toContain('@LynxAutolinkNativeModule(name = "ButtonModule")');
    expect(
      read(dir, 'android/src/main/java/com/example/button/ButtonElement.java'),
    ).toContain('@LynxAutolinkElement(name = "x-button")');
    expect(
      read(dir, 'android/src/main/java/com/example/button/ButtonService.java'),
    ).toContain('@LynxAutolinkService');
    expect(read(dir, 'ios/src/ButtonModule.h')).toContain(
      '@LynxAutolinkNativeModule("ButtonModule")',
    );
    expect(read(dir, 'ios/src/ButtonElement.h')).toContain(
      '@LynxAutolinkUI("x-button")',
    );
    expect(read(dir, 'ios/src/ButtonService.h')).toContain(
      '@LynxAutolinkService(ButtonService, ButtonServiceProtocol)',
    );
  });

  it('creates Native Module only projects without element or service files', () => {
    const dir = createTempDir('module');
    const files = createLynxExtension({
      dir,
      types: ['native-module'],
      packageName: 'storage-extension',
      androidPackage: 'com.example.storage',
      moduleName: 'StorageModule',
    });

    expect(files.map((file) => file.path)).toContain(
      'android/src/main/java/com/example/storage/StorageModule.java',
    );
    expect(files.map((file) => file.path)).not.toContain(
      'android/src/main/java/com/example/storage/StorageElement.java',
    );
    expect(read(dir, 'src/index.ts')).toContain(
      'export { StorageModule } from \'../generated/StorageModule\';',
    );
  });

  it('creates Element and Service projects with Autolink markers', () => {
    const dir = createTempDir('view');
    const files = createLynxExtension({
      dir,
      types: ['element', 'service'],
      packageName: 'view-extension',
      androidPackage: 'com.example.view',
      elementName: 'x-view',
      serviceName: 'ViewService',
    });

    expect(files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        'ios/src/ViewElement.h',
        'ios/src/ViewService.h',
      ]),
    );
    expect(read(dir, 'types/index.d.ts')).toContain(
      'Add native module declarations',
    );
    expect(read(dir, 'src/index.ts')).toContain(
      'Native Autolink package entry',
    );
    expect(read(dir, 'android/src/main/java/com/example/view/ViewElement.java'))
      .toContain('@LynxAutolinkElement(name = "x-view")');
    expect(read(dir, 'ios/src/ViewService.h')).toContain(
      '@LynxAutolinkService(ViewService, ViewServiceProtocol)',
    );
    expect(read(dir, 'example/src/App.tsx')).not.toContain('import {');
  });

  it('rejects generated paths that escape the target directory', () => {
    const dir = createTempDir('escape');

    expect(() =>
      createLynxExtension({
        dir,
        types: ['native-module'],
        packageName: 'escape-extension',
        androidPackage: 'com.example.escape',
        moduleName: '../../../../../../../../EscapeModule',
      })
    ).toThrow(/Generated path escapes target directory/);
  });

  it('refuses to overwrite a non-empty directory', () => {
    const dir = createTempDir('nonempty');
    fs.writeFileSync(path.join(dir, 'package.json'), '{}');

    expect(() => createLynxExtension({ dir, types: ['native-module'] }))
      .toThrow(/not empty/);
  });
});

function createTempDir(name: string): string {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'lynx-extension-'));
  const dir = path.join(parent, name);
  fs.mkdirSync(dir, { recursive: true });
  tempDirs.push(parent);
  return dir;
}

function read(root: string, file: string): string {
  return fs.readFileSync(path.join(root, file), 'utf8');
}
