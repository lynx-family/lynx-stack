// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createLynxLibrary,
  parseLibraryFeatures,
  parseLibraryPlatforms,
} from '../src/index.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});

describe('create-lynx-library', () => {
  it('parses non-interactive library feature flags', () => {
    expect(parseLibraryFeatures('native-module,element,service')).toEqual([
      'native-module',
      'element',
      'service',
    ]);
    expect(parseLibraryFeatures('ALL')).toEqual([
      'native-module',
      'element',
      'service',
    ]);
    expect(() => parseLibraryFeatures('web')).toThrow(
      /Unsupported library feature/,
    );
  });

  it('parses non-interactive Native platform flags', () => {
    expect(parseLibraryPlatforms('android,ios')).toEqual(['android', 'ios']);
    expect(parseLibraryPlatforms('ALL')).toEqual(['android', 'ios']);
    expect(() => parseLibraryPlatforms('web')).toThrow(
      /Unsupported Native platform/,
    );
  });

  it('creates a mixed native Lynx library for all platforms by default', () => {
    const dir = createTempDir('mixed');
    const files = createLynxLibrary({
      dir,
      features: ['native-module', 'element', 'service'],
      packageName: '@example/lynx-button',
      androidPackage: 'com.example.button',
      moduleName: 'ButtonModule',
      elementName: 'x-button',
      serviceName: 'ButtonService',
      dependencyVersions: {
        '@lynx-js/autolink-codegen': '^0.123.0',
      },
    });

    expect(files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        'package.json',
        'lynx.lib.json',
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
      '"@lynx-js/autolink-codegen": "^0.123.0"',
    );
    expect(read(dir, 'package.json')).not.toContain(
      '"@lynx-js/autolink-codegen": "^0.0.0"',
    );
    expect(read(dir, 'package.json')).not.toContain('workspace:');
    expect(read(dir, 'lynx.lib.json')).toContain(
      '"packageName": "com.example.button"',
    );
    expect(readJson<Manifest>(dir, 'lynx.lib.json').platforms).toEqual({
      android: {
        packageName: 'com.example.button',
        sourceDir: 'android',
      },
      ios: {
        sourceDir: 'ios',
        podspecPath: 'ios/build.podspec',
      },
    });
    expect(read(dir, 'ios/build.podspec')).toContain(
      's.dependency \'LynxServiceAPI\'',
    );
    expect(read(dir, 'types/index.d.ts')).toContain('/** @lynxmodule */');
    expect(read(dir, 'types/index.d.ts')).toContain(
      'setValue(key: string, value: string): void;',
    );
    expect(
      read(dir, 'android/src/main/java/com/example/button/ButtonModule.java'),
    ).toContain('@LynxNativeModule(name = "ButtonModule")');
    expect(
      read(dir, 'android/src/main/java/com/example/button/ButtonModule.java'),
    ).toContain('import com.lynx.jsbridge.LynxNativeModule;');
    expect(
      read(dir, 'android/src/main/java/com/example/button/ButtonModule.java'),
    ).toContain('import com.lynx.jsbridge.LynxMethod;');
    expect(
      read(dir, 'android/src/main/java/com/example/button/ButtonElement.java'),
    ).toContain('@LynxElement(name = "x-button")');
    expect(
      read(dir, 'android/src/main/java/com/example/button/ButtonElement.java'),
    ).toContain('import com.lynx.tasm.behavior.LynxElement;');
    expect(
      read(dir, 'android/src/main/java/com/example/button/ButtonService.java'),
    ).toContain('@LynxService');
    expect(
      read(dir, 'android/src/main/java/com/example/button/ButtonService.java'),
    ).toContain('import com.lynx.tasm.service.LynxService;');
    expect(read(dir, 'ios/src/ButtonModule.h')).toContain(
      '@LynxNativeModuleRegister("ButtonModule")',
    );
    expect(read(dir, 'ios/src/ButtonModule.m')).toContain(
      '+ (NSDictionary<NSString *, NSString *> *)methodLookup',
    );
    expect(read(dir, 'ios/src/ButtonElement.h')).toContain(
      '@LynxUIRegister("x-button")',
    );
    expect(read(dir, 'ios/src/ButtonService.m')).toContain(
      '@LynxServiceRegister(ButtonService, ButtonServiceProtocol)',
    );
    expect(read(dir, 'ios/src/ButtonService.h')).toContain(
      '@protocol ButtonServiceProtocol <LynxServiceProtocol>',
    );
    expect(read(dir, 'ios/src/ButtonService.h')).toContain(
      '#import <LynxServiceAPI/ServiceAPI.h>',
    );
    expect(files.every((file) => !/__[A-Z0-9_]+__/.test(file.path))).toBe(
      true,
    );
    expect(files.every((file) => !/__[A-Z0-9_]+__/.test(file.content))).toBe(
      true,
    );
  });

  it('creates Native Module only projects without element or service files', () => {
    const dir = createTempDir('module');
    const files = createLynxLibrary({
      dir,
      features: ['native-module'],
      packageName: 'storage-library',
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
    expect(read(dir, 'ios/build.podspec')).not.toContain('LynxServiceAPI');
  });

  it('creates Android-only projects without iOS files', () => {
    const dir = createTempDir('android-only');
    const files = createLynxLibrary({
      dir,
      features: ['native-module', 'element', 'service'],
      platforms: ['android'],
      packageName: 'android-library',
      androidPackage: 'com.example.android',
      moduleName: 'AndroidModule',
      elementName: 'x-android',
      serviceName: 'AndroidService',
    });
    const filePaths = files.map((file) => file.path);

    expect(filePaths).toContain(
      'android/src/main/java/com/example/android/AndroidModule.java',
    );
    expect(filePaths).toContain(
      'android/src/main/java/com/example/android/AndroidElement.java',
    );
    expect(filePaths).toContain(
      'android/src/main/java/com/example/android/AndroidService.java',
    );
    expect(filePaths.some((file) => file.startsWith('ios/'))).toBe(false);
    expect(readJson<Manifest>(dir, 'lynx.lib.json').platforms).toEqual({
      android: {
        packageName: 'com.example.android',
        sourceDir: 'android',
      },
    });
    expect(readJson<PackageJson>(dir, 'package.json').files).toContain(
      'android',
    );
    expect(readJson<PackageJson>(dir, 'package.json').files).not.toContain(
      'ios',
    );
    expect(read(dir, 'README.md')).toContain('`android/`');
    expect(read(dir, 'README.md')).not.toContain('`ios/`');
  });

  it('creates iOS-only projects without Android files', () => {
    const dir = createTempDir('ios-only');
    const files = createLynxLibrary({
      dir,
      features: ['native-module', 'element', 'service'],
      platforms: ['ios'],
      packageName: 'ios-library',
      moduleName: 'IosModule',
      elementName: 'x-ios',
      serviceName: 'IosService',
    });
    const filePaths = files.map((file) => file.path);

    expect(filePaths).toContain('ios/src/IosModule.h');
    expect(filePaths).toContain('ios/src/IosElement.h');
    expect(filePaths).toContain('ios/src/IosService.h');
    expect(filePaths.some((file) => file.startsWith('android/'))).toBe(false);
    expect(readJson<Manifest>(dir, 'lynx.lib.json').platforms).toEqual({
      ios: {
        sourceDir: 'ios',
        podspecPath: 'ios/build.podspec',
      },
    });
    expect(readJson<PackageJson>(dir, 'package.json').files).toContain('ios');
    expect(readJson<PackageJson>(dir, 'package.json').files).not.toContain(
      'android',
    );
    expect(read(dir, 'ios/build.podspec')).toContain('LynxServiceAPI');
    expect(read(dir, 'README.md')).toContain('`ios/`');
    expect(read(dir, 'README.md')).not.toContain('`android/`');
  });

  it('creates Element and Service projects with Lynx markers', () => {
    const dir = createTempDir('view');
    const files = createLynxLibrary({
      dir,
      features: ['element', 'service'],
      packageName: 'view-library',
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
      'Lynx library package entry',
    );
    expect(read(dir, 'android/src/main/java/com/example/view/ViewElement.java'))
      .toContain('@LynxElement(name = "x-view")');
    expect(read(dir, 'ios/src/ViewService.m')).toContain(
      '@LynxServiceRegister(ViewService, ViewServiceProtocol)',
    );
    expect(read(dir, 'example/src/App.tsx')).not.toContain('import {');
  });

  it('fails when package templates contain unmapped workspace dependencies', () => {
    const dir = createTempDir('missing-version');

    expect(() =>
      createLynxLibrary({
        dir,
        features: ['native-module'],
        dependencyVersions: {},
      })
    ).toThrow(
      /workspace dependencies without version mappings: @lynx-js\/autolink-codegen/,
    );
  });

  it('requires at least one Native platform', () => {
    const dir = createTempDir('missing-platform');

    expect(() =>
      createLynxLibrary({
        dir,
        features: ['native-module'],
        platforms: [],
      })
    ).toThrow(/At least one Native platform/);
  });

  it('rejects unsupported Native platforms', () => {
    const dir = createTempDir('unsupported-platform');

    expect(() =>
      createLynxLibrary({
        dir,
        features: ['native-module'],
        platforms: ['web' as never],
      })
    ).toThrow(/Unsupported Native platform/);
  });

  it('adds package template context when rendered package JSON is invalid', () => {
    const dir = createTempDir('invalid-json');

    expect(() =>
      createLynxLibrary({
        dir,
        features: ['native-module'],
        packageName: 'bad"name',
        dependencyVersions: {
          '@lynx-js/autolink-codegen': '^0.123.0',
        },
      })
    ).toThrow(
      /Invalid package\.json template after rendering: .*package\.json/,
    );
  });

  it('rejects generated paths that escape the target directory', () => {
    const dir = createTempDir('escape');

    expect(() =>
      createLynxLibrary({
        dir,
        features: ['native-module'],
        packageName: 'escape-library',
        androidPackage: 'com.example.escape',
        moduleName: '../../../../../../../../EscapeModule',
      })
    ).toThrow(/Generated path escapes target directory/);
  });

  it('refuses to overwrite a non-empty directory', () => {
    const dir = createTempDir('nonempty');
    fs.writeFileSync(path.join(dir, 'package.json'), '{}');

    expect(() => createLynxLibrary({ dir, features: ['native-module'] }))
      .toThrow(/not empty/);
  });

  it('fails clearly when the target exists as a file', () => {
    const dir = createTempDir('file-target');
    fs.rmSync(dir, { recursive: true });
    fs.writeFileSync(dir, '');

    expect(() => createLynxLibrary({ dir, features: ['native-module'] }))
      .toThrow(/not a directory/);
  });
});

function createTempDir(name: string): string {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'lynx-library-'));
  const dir = path.join(parent, name);
  fs.mkdirSync(dir, { recursive: true });
  tempDirs.push(parent);
  return dir;
}

function read(root: string, file: string): string {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function readJson<T>(root: string, file: string): T {
  return JSON.parse(read(root, file)) as T;
}

interface Manifest {
  platforms: Record<string, unknown>;
}

interface PackageJson {
  files: string[];
}
