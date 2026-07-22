// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { execFileSync } from 'node:child_process';
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

function execNpm(args: string[], options: { cwd: string }): string {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return execFileSync(npmCommand, args, {
    ...options,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
}

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
      'napi-native-module',
      'element',
      'service',
    ]);
    expect(() => parseLibraryFeatures('web')).toThrow(
      /Unsupported library feature/,
    );
  });

  it('parses non-interactive Native platform flags', () => {
    expect(parseLibraryPlatforms('android,ios,lynxtron')).toEqual([
      'android',
      'ios',
      'lynxtron',
    ]);
    expect(parseLibraryPlatforms('ALL')).toEqual([
      'android',
      'ios',
      'lynxtron',
    ]);
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
        'types/platform-native-module.d.ts',
        'src/index.ts',
        'shared/CMakeLists.txt',
        'lynxtron/CMakeLists.txt',
        'lynxtron/index.cjs',
        'lynxtron/library_entry.cc',
        'shared/elements/CMakeLists.txt',
        'shared/elements/ButtonElement.h',
        'shared/elements/ButtonElement.cc',
        'shared/elements/ButtonElementRegistration.cc',
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
    const packageJson = readJson<
      PackageJson & {
        devDependencies: Record<string, string>;
        exports: {
          '.': { types: string; default: string };
          './lynxtron': string;
          './package.json': string;
        };
      }
    >(dir, 'package.json');

    expect(packageJson.files).toEqual(
      expect.arrayContaining(['android', 'dist', 'lynxtron', 'shared', 'ios']),
    );
    expect(packageJson.files).not.toContain('CMakeLists.txt');
    expect(packageJson.exports).toMatchObject({
      '.': {
        types: './types/index.d.ts',
        default: './src/index.ts',
      },
      './lynxtron': './lynxtron/index.cjs',
      './package.json': './package.json',
    });
    expect(read(dir, 'android/build.gradle.kts')).toContain(
      'javaClass.methods.firstOrNull { it.name == "setNamespace" }',
    );
    expect(read(dir, 'android/build.gradle.kts')).toContain(
      'compileSdkVersion(35)',
    );
    expect(read(dir, 'android/build.gradle.kts')).toContain(
      'minSdkVersion(23)',
    );
    expect(read(dir, 'android/src/main/AndroidManifest.xml')).toContain(
      'package="com.example.button"',
    );
    expect(read(dir, 'example/lynx.config.ts')).toContain(
      'main: \'./src/index.tsx\'',
    );
    expect(read(dir, 'example/src/index.tsx')).toContain(
      'import { App } from \'./App\';',
    );
    expect(read(dir, 'README.md')).not.toContain(
      '## NAPI Native Module',
    );
    expect(read(dir, 'README.md')).toContain(
      'Platform native module typings live in `types/platform-native-module.d.ts`',
    );
    expect(read(dir, 'README.md')).not.toContain(
      'NAPI native module typings live in `types/napi-native-module.d.ts`',
    );
    expect(packageJson.devDependencies['@lynx-js/lynx-library-headers'])
      .toBe('*');
    expect(read(dir, 'package.json')).toContain(
      '"build:lynxtron": "cmake -S lynxtron -B build/lynxtron -DCMAKE_BUILD_TYPE=Release && cmake --build build/lynxtron --config Release"',
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
        podspecPath: 'ios/example-lynx-button.podspec',
      },
      'lynxtron': {
        path: 'dist',
      },
      macos: {
        sourceDir: 'shared',
      },
      windows: {
        sourceDir: 'shared',
      },
    });
    expect(read(dir, 'lynxtron/CMakeLists.txt')).toContain(
      '${LYNX_LIBRARY_PACKAGE_ROOT}/shared',
    );
    expect(read(dir, 'lynxtron/CMakeLists.txt')).toContain(
      'LYNX_LIBRARY_NODE_API_WEAK_SUFFIX',
    );
    expect(read(dir, 'lynxtron/index.cjs')).toContain(
      'nativeBinding.initialize = function initialize() {};',
    );
    expect(read(dir, 'lynxtron/library_entry.cc')).not.toContain(
      'lynx_env_register_native_module',
    );
    expect(read(dir, 'lynxtron/library_entry.cc')).not.toContain(
      'napi_module_register_xx',
    );
    expect(read(dir, 'shared/CMakeLists.txt')).toContain(
      'CMAKE_SYSTEM_NAME STREQUAL "OHOS"',
    );
    expect(read(dir, 'shared/CMakeLists.txt')).toContain(
      'require.resolve(\'${PACKAGE_NAME}/package.json\')',
    );
    expect(read(dir, 'shared/CMakeLists.txt')).toContain(
      '"@lynx-js/lynx-library-headers"',
    );
    expect(read(dir, 'shared/CMakeLists.txt')).toContain(
      'lynx_resolve_lynxtron_import_library',
    );
    expect(read(dir, 'shared/CMakeLists.txt')).toContain(
      '"@lynx-js/weak-node-api"',
    );
    expect(read(dir, 'shared/elements/CMakeLists.txt')).not.toContain(
      'LYNX_SHARED_ENABLE_STATIC_REGISTER',
    );
    expect(read(dir, 'shared/elements/CMakeLists.txt')).toMatch(
      /if\(LYNX_NATIVE_ELEMENT_BACKEND_TEXTURE\)[\s\S]*backends\/texture\/windows\/\*\.cc[\s\S]*else\(\)[\s\S]*backends\/native-ui\/windows\/\*\.cc/,
    );
    expect(read(dir, 'ios/example-lynx-button.podspec')).toContain(
      's.dependency \'LynxServiceAPI\'',
    );
    expect(read(dir, 'types/index.d.ts')).toContain(
      'export * from \'./platform-native-module\';',
    );
    expect(read(dir, 'types/platform-native-module.d.ts')).toContain(
      '/** @lynxmodule */',
    );
    expect(read(dir, 'types/platform-native-module.d.ts')).toContain(
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
    expect(read(dir, 'shared/elements/ButtonElementRegistration.cc')).toContain(
      'LYNX_REGISTER_ELEMENT(',
    );
    expect(read(dir, 'shared/elements/ButtonElement.h')).toContain(
      'class ButtonElementView : public lynx::pub::LynxNativeView',
    );
    expect(
      read(dir, 'shared/elements/backends/texture/ButtonElementTexture.cc'),
    ).toContain('class ButtonElementTextureView : public ButtonElementView');
    expect(
      read(
        dir,
        'shared/elements/backends/native-ui/macos/ButtonElementNativeUI.mm',
      ),
    ).toContain('class ButtonElementNativeUIView : public ButtonElementView');
    expect(
      read(
        dir,
        'shared/elements/backends/native-ui/windows/ButtonElementNativeUI.cc',
      ),
    ).toContain('class ButtonElementNativeUIView : public ButtonElementView');
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
      'shared/CMakeLists.txt',
    );
    expect(files.map((file) => file.path)).not.toContain(
      'lynxtron/CMakeLists.txt',
    );
    expect(files.map((file) => file.path)).not.toContain(
      'android/src/main/java/com/example/storage/StorageElement.java',
    );
    expect(files.map((file) => file.path)).not.toContain(
      'shared/elements/StorageElement.cc',
    );
    expect(read(dir, 'src/index.ts')).toContain(
      'export { StorageModule } from \'../generated/StorageModule\';',
    );
    expect(read(dir, 'ios/storage-library.podspec')).not.toContain(
      'LynxServiceAPI',
    );
  });

  it('creates NAPI Native Module projects with split typings', () => {
    const dir = createTempDir('napi-module');
    const files = createLynxLibrary({
      dir,
      features: ['napi-native-module'],
      packageName: 'napi-library',
      moduleName: 'StorageModule',
    });
    const filePaths = files.map((file) => file.path);

    expect(filePaths).toContain('shared/CMakeLists.txt');
    expect(filePaths).toContain('shared/nativeModule/CMakeLists.txt');
    expect(filePaths).toContain('android/CMakeLists.txt');
    expect(filePaths).toContain('ios/addon_use.h');
    expect(filePaths).toContain('lynxtron/CMakeLists.txt');
    expect(filePaths).toContain('types/napi-native-module.d.ts');
    expect(filePaths).not.toContain(
      'android/src/main/java/com/example/storage/StorageModule.java',
    );
    expect(read(dir, 'types/index.d.ts')).toContain(
      'export * from \'./napi-native-module\';',
    );
    expect(read(dir, 'types/napi-native-module.d.ts')).toContain(
      'export declare class StorageModule',
    );
    expect(read(dir, 'src/index.ts')).toContain(
      'export { StorageModule } from \'../generated/StorageModule\';',
    );
    expect(read(dir, 'shared/CMakeLists.txt')).toContain(
      'add_subdirectory(nativeModule)',
    );
    expect(read(dir, 'shared/nativeModule/CMakeLists.txt')).toContain(
      'NapiNativeModules',
    );
    expect(read(dir, 'android/build.gradle.kts')).toContain(
      'externalNativeBuild',
    );
    expect(read(dir, 'android/build.gradle.kts')).toContain(
      'version = "3.18.1"',
    );
    expect(read(dir, 'android/CMakeLists.txt')).toContain(
      'cmake_minimum_required(VERSION 3.18.1)',
    );
    expect(read(dir, 'shared/CMakeLists.txt')).toContain(
      'cmake_minimum_required(VERSION 3.18.1)',
    );
    expect(read(dir, 'lynxtron/CMakeLists.txt')).toContain(
      'cmake_minimum_required(VERSION 3.18.1)',
    );
    expect(read(dir, 'README.md')).toContain(
      'Codegen creates `shared/nativeModule/StorageModule.cc` once',
    );
    expect(read(dir, 'README.md')).toContain(
      'TypeScript shim is only for the selected mobile runtimes',
    );
    expect(read(dir, 'shared/.npmignore')).toContain('third_party/');
    fs.mkdirSync(path.join(dir, 'shared/third_party'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'shared/third_party/cache.txt'), 'cache');
    fs.mkdirSync(path.join(dir, 'dist/macos/arm64'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'dist/macos/arm64/addon.node'), 'addon');
    const packResult = JSON.parse(
      execNpm(['pack', '--dry-run', '--json'], { cwd: dir }),
    ) as Array<{ files: Array<{ path: string }> }>;
    const packedPaths = packResult[0]?.files.map((file) => file.path) ?? [];
    expect(packedPaths).toContain('dist/macos/arm64/addon.node');
    expect(packedPaths).not.toContain('shared/third_party/cache.txt');
    expect(read(dir, 'android/build.gradle.kts')).toContain(
      'providers.gradleProperty("lynx.primjs.version").orElse("4.+").get()',
    );
    expect(read(dir, 'android/build.gradle.kts')).toContain(
      'org.lynxsdk.lynx:primjs:$lynxPrimjsVersion',
    );
    expect(read(dir, 'android/build.gradle.kts')).toContain(
      'org.lynxsdk.lynx:primjs:$lynxPrimjsVersion@aar',
    );
    expect(read(dir, 'android/build.gradle.kts')).not.toContain(
      '4.0.1-alpha.3',
    );
    expect(read(dir, 'android/build.gradle.kts')).not.toContain(
      'org.lynxsdk.lynx:lynx:0.0.1-alpha.1',
    );
    expect(read(dir, 'android/build.gradle.kts')).not.toContain(
      'org.lynxsdk.lynx:service-api:0.0.1-alpha.1',
    );
    expect(read(dir, 'android/build.gradle.kts')).not.toContain(
      'org.lynxsdk.lynx:lynx-processor:0.0.1-alpha.1',
    );
    expect(read(dir, 'android/build.gradle.kts')).toContain(
      'extractPrimjsNativeLibraries',
    );
    expect(read(dir, 'android/build.gradle.kts')).toContain(
      '-DLYNX_PRIMJS_JNI_DIR=',
    );
    expect(read(dir, 'android/CMakeLists.txt')).toContain(
      'OUTPUT_NAME "StorageModule"',
    );
    expect(read(dir, 'android/CMakeLists.txt')).toContain(
      'LYNX_LIBRARY_NODE_API_WEAK_SUFFIX OFF',
    );
    expect(read(dir, 'android/CMakeLists.txt')).not.toContain(
      'LYNX_LIBRARY_NODE_API_WEAK_SUFFIX ON',
    );
    expect(read(dir, 'android/CMakeLists.txt')).toContain(
      'LYNX_LIBRARY_USE_PRIMJS_NAPI_MODULE ON',
    );
    expect(read(dir, 'android/CMakeLists.txt')).toContain(
      'IMPORTED_LOCATION "${LYNX_PRIMJS_ABI_DIR}/libnapi_adapter.so"',
    );
    expect(read(dir, 'android/CMakeLists.txt')).toContain(
      'IMPORTED_LOCATION "${LYNX_PRIMJS_ABI_DIR}/libnapi.so"',
    );
    expect(read(dir, 'android/CMakeLists.txt')).toContain(
      'lynx_primjs_napi_adapter',
    );
    expect(read(dir, 'ios/napi-library.podspec')).toContain(
      's.dependency \'LynxWeakNodeAPI\'',
    );
    expect(read(dir, 'ios/napi-library.podspec')).toContain(
      '${PODS_ROOT}/LynxWeakNodeAPI/packages/weak-node-api/headers',
    );
    expect(read(dir, 'ios/napi-library.podspec')).toContain(
      '${PODS_ROOT}/PrimJS/src/napi',
    );
    expect(read(dir, 'ios/napi-library.podspec')).toContain(
      'generated/**/*.{cc,h,mm}',
    );
    expect(read(dir, 'ios/napi-library.podspec')).toContain(
      'LYNX_LIBRARY_USE_PRIMJS_NAPI_MODULE=1',
    );
    expect(read(dir, 'ios/napi-library.podspec')).not.toContain(
      'USE_WEAK_SUFFIX_NAPI',
    );
    expect(read(dir, 'ios/addon_use.h')).toContain('#ifndef NAPI_USE');
    expect(read(dir, 'ios/addon_use.h')).toContain('NAPI_USE(StorageModule)');
    expect(read(dir, 'ios/addon_use.h')).toContain(
      '__attribute__((used)) static void*',
    );
    expect(
      readJson<PackageJson>(dir, 'package.json').dependencies
        ?.['@lynx-js/weak-node-api'],
    ).toBe(
      '^0.0.9',
    );
    expect(
      readJson<PackageJson>(dir, 'package.json').dependencies
        ?.['@lynx-js/lynx-library-headers'],
    ).toBe(
      '*',
    );
    expect(
      readJson<PackageJson>(dir, 'package.json').devDependencies
        ?.['@lynx-js/lynx-library-headers'],
    ).toBeUndefined();
    expect(read(dir, 'android/build.gradle.kts')).not.toContain(
      'absolutePath}",',
    );
    expect(
      readJson<Manifest>(dir, 'lynx.lib.json').platforms.android?.nodeApiAddons,
    ).toEqual([
      {
        name: 'StorageModule',
        libraryName: 'StorageModule',
        jniLibsDir: 'android/src/main/jniLibs',
        required: false,
      },
    ]);
    expect(
      readJson<Manifest>(dir, 'lynx.lib.json').platforms.ios?.nodeApiAddons,
    ).toEqual([
      {
        name: 'StorageModule',
        podName: 'napi-library',
        podspecPath: 'ios/napi-library.podspec',
        addonUseHeader: 'addon_use.h',
        required: true,
      },
    ]);
  });

  it('creates Lynxtron projects with shared C++ sources', () => {
    const dir = createTempDir('lynxtron');
    const files = createLynxLibrary({
      dir,
      features: ['napi-native-module', 'element'],
      platforms: ['lynxtron'],
      packageName: '@example/lynxtron-library',
      moduleName: 'LynxtronModule',
      elementName: 'x-lynxtron',
    });
    const filePaths = files.map((file) => file.path);

    expect(filePaths).toEqual(
      expect.arrayContaining([
        'shared/CMakeLists.txt',
        'lynxtron/CMakeLists.txt',
        'lynxtron/index.cjs',
        'lynxtron/library_entry.cc',
        'shared/nativeModule/CMakeLists.txt',
        'shared/elements/CMakeLists.txt',
        'shared/elements/LynxtronElement.cc',
        'shared/elements/LynxtronElementRegistration.cc',
      ]),
    );
    expect(filePaths.some((file) => file.startsWith('android/'))).toBe(false);
    expect(filePaths.some((file) => file.startsWith('ios/'))).toBe(false);
    expect(filePaths).not.toContain('CMakeLists.txt');

    const packageJson = readJson<
      PackageJson & {
        devDependencies: Record<string, string>;
        exports: {
          '.': { types: string; default: string };
          './lynxtron': string;
          './package.json': string;
        };
      }
    >(dir, 'package.json');

    expect(packageJson.files).toEqual(
      expect.arrayContaining(['dist', 'lynxtron', 'shared']),
    );
    expect(packageJson.files).not.toContain('android');
    expect(packageJson.files).not.toContain('ios');
    expect(packageJson.files).not.toContain('CMakeLists.txt');
    expect(packageJson.exports).toMatchObject({
      '.': {
        types: './types/index.d.ts',
        default: './src/index.ts',
      },
      './lynxtron': './lynxtron/index.cjs',
      './package.json': './package.json',
    });
    expect(packageJson.dependencies?.['@lynx-js/lynx-library-headers'])
      .toBe('*');
    expect(packageJson.devDependencies['@lynx-js/lynx-library-headers'])
      .toBeUndefined();
    expect(packageJson.dependencies?.['@lynx-js/weak-node-api']).toBe(
      '^0.0.9',
    );
    expect(read(dir, 'package.json')).toContain(
      '"build:lynxtron": "cmake -S lynxtron -B build/lynxtron -DCMAKE_BUILD_TYPE=Release && cmake --build build/lynxtron --config Release"',
    );
    expect(readJson<Manifest>(dir, 'lynx.lib.json').platforms).toEqual({
      'lynxtron': {
        path: 'dist',
      },
      macos: {
        sourceDir: 'shared',
      },
      windows: {
        sourceDir: 'shared',
      },
    });
    expect(read(dir, 'lynxtron/CMakeLists.txt')).toContain(
      '${LYNX_LIBRARY_PACKAGE_ROOT}/shared',
    );
    expect(read(dir, 'lynxtron/CMakeLists.txt')).toContain(
      'LYNX_LIBRARY_NODE_API_WEAK_SUFFIX',
    );
    expect(read(dir, 'lynxtron/index.cjs')).toContain(
      'nativeBinding.initialize = function initialize() {};',
    );
    expect(read(dir, 'lynxtron/library_entry.cc')).toContain(
      'LynxAutolinkRegisterNapiNativeModules',
    );
    expect(read(dir, 'lynxtron/library_entry.cc')).not.toContain(
      'napi_module_register_xx',
    );
    expect(read(dir, 'lynxtron/CMakeLists.txt')).toContain(
      'generated_napi_registration.cc',
    );
    expect(read(dir, 'shared/CMakeLists.txt')).toContain(
      'CMAKE_SYSTEM_NAME STREQUAL "OHOS"',
    );
    expect(read(dir, 'shared/CMakeLists.txt')).toContain(
      'require.resolve(\'${PACKAGE_NAME}/package.json\')',
    );
    expect(read(dir, 'shared/CMakeLists.txt')).toContain(
      '"@lynx-js/lynx-library-headers"',
    );
    expect(read(dir, 'shared/CMakeLists.txt')).toContain(
      'lynx_resolve_lynxtron_import_library',
    );
    expect(read(dir, 'shared/CMakeLists.txt')).toContain(
      '"@lynx-js/weak-node-api"',
    );
    expect(read(dir, 'shared/nativeModule/CMakeLists.txt')).toContain(
      'LYNX_LIBRARY_NODE_API_WEAK_SUFFIX',
    );
    expect(read(dir, 'shared/nativeModule/CMakeLists.txt')).toContain(
      'LYNX_LIBRARY_USE_PRIMJS_NAPI_MODULE=1',
    );
    expect(read(dir, 'shared/CMakeLists.txt')).toContain(
      'LYNX_LIBRARY_NAPI_NATIVE_MODULE_TARGET',
    );
    expect(read(dir, 'shared/nativeModule/CMakeLists.txt')).not.toContain(
      'LYNX_SHARED_ENABLE_WEAK_NAPI',
    );
    expect(read(dir, 'shared/elements/CMakeLists.txt')).not.toContain(
      'LYNX_SHARED_ENABLE_STATIC_REGISTER',
    );
    expect(read(dir, 'shared/elements/CMakeLists.txt')).toMatch(
      /if\(LYNX_NATIVE_ELEMENT_BACKEND_TEXTURE\)[\s\S]*backends\/texture\/windows\/\*\.cc[\s\S]*else\(\)[\s\S]*backends\/native-ui\/windows\/\*\.cc/,
    );
    expect(read(dir, 'README.md')).toContain('`lynxtron/`');
    expect(read(dir, 'README.md')).toContain('`shared/`');
    expect(read(dir, 'README.md')).toContain(
      '`npm pack` and `npm publish` do not build native artifacts',
    );
    expect(read(dir, 'README.md')).toContain(
      `require('@example/lynxtron-library/lynxtron')`,
    );
    expect(read(dir, 'README.md')).toContain(
      'Lynxtron BTS code does not import the package root',
    );
    expect(read(dir, 'README.md')).not.toContain(
      'On Android and iOS, import the package root',
    );
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

  it('documents the shim only for selected NAPI mobile platforms', () => {
    const dir = createTempDir('android-napi-only');

    createLynxLibrary({
      dir,
      features: ['napi-native-module'],
      platforms: ['android'],
      packageName: 'android-napi-library',
      androidPackage: 'com.example.androidnapi',
      moduleName: 'AndroidNapiModule',
    });

    expect(read(dir, 'README.md')).toContain(
      'On Android, import the package root in BTS',
    );
    expect(read(dir, 'README.md')).not.toContain(
      'On Android and iOS',
    );
    expect(read(dir, 'README.md')).not.toContain(
      '## Lynxtron Library Target',
    );
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
        podspecPath: 'ios/ios-library.podspec',
      },
    });
    expect(readJson<PackageJson>(dir, 'package.json').files).toContain('ios');
    expect(readJson<PackageJson>(dir, 'package.json').files).not.toContain(
      'android',
    );
    expect(read(dir, 'ios/ios-library.podspec')).toContain('LynxServiceAPI');
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
        'shared/CMakeLists.txt',
        'lynxtron/CMakeLists.txt',
        'lynxtron/index.cjs',
        'lynxtron/library_entry.cc',
        'shared/elements/CMakeLists.txt',
        'shared/elements/ViewElement.cc',
        'shared/elements/ViewElementRegistration.cc',
        'ios/src/ViewElement.h',
        'ios/src/ViewService.h',
      ]),
    );
    expect(files.map((file) => file.path)).not.toContain(
      'shared/modules/ViewLibraryModule.cc',
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
    expect(JSON.parse(read(dir, 'lynx.lib.json'))).toMatchObject({
      platforms: {
        'lynxtron': {
          path: 'dist',
        },
        macos: {
          sourceDir: 'shared',
        },
        windows: {
          sourceDir: 'shared',
        },
      },
    });
    expect(read(dir, 'example/src/App.tsx')).not.toContain('import {');
    expect(read(dir, 'README.md')).toContain(
      'This feature selection does not include native module typings.',
    );
    expect(read(dir, 'README.md')).not.toContain(
      'types/platform-native-module.d.ts',
    );
    expect(read(dir, 'README.md')).not.toContain(
      'types/napi-native-module.d.ts',
    );
    expect(read(dir, 'README.md')).not.toContain(
      'Lynxtron BTS code does not import the package root',
    );
    expect(read(dir, 'README.md')).not.toContain(
      'NativeModules.ViewLibraryModule',
    );
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
  platforms: Record<string, unknown> & {
    android?: { nodeApiAddons?: unknown[] };
    ios?: { nodeApiAddons?: unknown[] };
  };
}

interface PackageJson {
  files: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
