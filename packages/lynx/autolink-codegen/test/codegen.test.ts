// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { generate, parseNativeModules, runCodegen } from '../src/index.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});

describe('@lynx-js/autolink-codegen', () => {
  it('parses @lynxmodule declarations from d.ts sources', () => {
    const modules = parseNativeModules(
      `/** @lynxmodule */
export declare class StorageModule {
  setValue(key: string, value: string): void;
  getValue(key: string): string | null;
  hasValue(key: string): boolean;
  score(): number;
}
`,
      'types\\index.d.ts',
    );

    expect(modules).toEqual([
      {
        name: 'StorageModule',
        source: { file: 'types/index.d.ts', line: 1 },
        methods: [
          {
            name: 'setValue',
            params: [
              {
                name: 'key',
                source: { file: 'types/index.d.ts', line: 3 },
                type: { name: 'string', nullable: false },
              },
              {
                name: 'value',
                source: { file: 'types/index.d.ts', line: 3 },
                type: { name: 'string', nullable: false },
              },
            ],
            returnType: { name: 'void', nullable: false },
            source: { file: 'types/index.d.ts', line: 3 },
          },
          {
            name: 'getValue',
            params: [
              {
                name: 'key',
                source: { file: 'types/index.d.ts', line: 4 },
                type: { name: 'string', nullable: false },
              },
            ],
            returnType: { name: 'string', nullable: true },
            source: { file: 'types/index.d.ts', line: 4 },
          },
          {
            name: 'hasValue',
            params: [
              {
                name: 'key',
                source: { file: 'types/index.d.ts', line: 5 },
                type: { name: 'string', nullable: false },
              },
            ],
            returnType: { name: 'boolean', nullable: false },
            source: { file: 'types/index.d.ts', line: 5 },
          },
          {
            name: 'score',
            params: [],
            returnType: { name: 'number', nullable: false },
            source: { file: 'types/index.d.ts', line: 6 },
          },
        ],
      },
    ]);
  });

  it('parses native module declarations without semicolons', () => {
    const modules = parseNativeModules(
      `/** @lynxmodule */
export declare class StorageModule {
  setValue(key: string, value: string): void
  getValue(key: string): string | null
}
`,
      'types/index.d.ts',
    );

    expect(modules[0]?.methods.map((method) => method.name)).toEqual([
      'setValue',
      'getValue',
    ]);
  });

  it('ignores comments inside native module declarations', () => {
    const modules = parseNativeModules(
      `/** @lynxmodule */
export declare class CommentedModule {
  /** Stores a value for the provided key. */
  setValue(
    key: string, // cache key
    value: string
  ): void; // native side returns nothing

  // Comment-only lines should not become method declarations.
  /**
   * Reads a value. Comments may include semicolons;
   * and inline links such as {@link CommentedModule}.
   */
  getValue(key: string): string | null
}
`,
      'types/commented.d.ts',
    );

    expect(modules[0]?.methods.map((method) => method.name)).toEqual([
      'setValue',
      'getValue',
    ]);
  });

  it('accepts trailing commas in native module parameters', () => {
    const modules = parseNativeModules(
      `/** @lynxmodule */
export declare class FormattedModule {
  setValue(
    key: string,
    value: string,
  ): void;
}
`,
      'types/formatted.d.ts',
    );

    expect(modules[0]?.methods[0]?.params.map((param) => param.name)).toEqual([
      'key',
      'value',
    ]);
  });

  it('generates JS, Android, and iOS specs', () => {
    const root = createFixture({
      manifest: {
        platforms: {
          android: {
            packageName: 'com.example.storage',
          },
          ios: {},
        },
      },
      types: `/** @lynxmodule */
export declare class StorageModule {
  setValue(key: string, value: string): void;
  getValue(key: string): string | null;
}
`,
    });

    const files = generate({ root });

    expect(files.map((file) => file.path).sort()).toEqual([
      'generated/StorageModule.ts',
      'android/src/main/java/com/example/storage/generated/StorageModuleSpec.java',
      'ios/src/generated/StorageModuleSpec.h',
      'ios/src/generated/StorageModuleSpec.m',
    ].sort());
    expect(files[0]?.content).toContain('NativeModules.StorageModule');
    expect(files[1]?.content).toContain(
      'package com.example.storage.generated;',
    );
    expect(files[1]?.content).toContain(
      'import com.lynx.jsbridge.LynxContextModule;',
    );
    expect(files[1]?.content).toContain('import com.lynx.jsbridge.LynxMethod;');
    expect(files[1]?.content).toContain(
      'import com.lynx.tasm.behavior.LynxContext;',
    );
    expect(files[1]?.content).toContain('public abstract void setValue');
    expect(files[2]?.content).toContain('@protocol StorageModuleSpec');
    expect(files[2]?.content).toContain(
      '- (nullable NSString *)getValue:(NSString *)key;',
    );
  });

  it('generates Android specs only when only Android is configured', () => {
    const root = createFixture({
      manifest: {
        platforms: {
          android: {
            packageName: 'com.example.storage',
          },
        },
      },
      types: `/** @lynxmodule */
export declare class StorageModule {
  clear(): void;
}
`,
    });

    const files = generate({ root });

    expect(files.map((file) => file.path).sort()).toEqual([
      'generated/StorageModule.ts',
      'android/src/main/java/com/example/storage/generated/StorageModuleSpec.java',
    ].sort());
  });

  it('generates iOS specs only when only iOS is configured', () => {
    const root = createFixture({
      manifest: {
        platforms: {
          ios: {},
        },
      },
      types: `/** @lynxmodule */
export declare class StorageModule {
  clear(): void;
}
`,
    });

    const files = generate({ root });

    expect(files.map((file) => file.path).sort()).toEqual([
      'generated/StorageModule.ts',
      'ios/src/generated/StorageModuleSpec.h',
      'ios/src/generated/StorageModuleSpec.m',
    ].sort());
  });

  it('generates shared NAPI stubs from napi native module typings', () => {
    const root = createFixture({
      manifest: {
        platforms: {
          lynxtron: {
            path: 'dist',
          },
        },
      },
      types: '',
    });
    writeTypesFile(
      root,
      'napi-native-module.d.ts',
      `/** @lynxmodule */
export declare class StorageNapiModule {
  setValue(key: string, value: string): void;
  getValue(key: string): string | null;
  configure(
    options: object,
    items: string[],
    callback: Function,
    data: ArrayBuffer,
    bytes: Uint8Array,
    metadata: Map<string, unknown>,
  ): Promise<unknown>;
}
`,
    );

    const files = generate({ root });

    expect(files.map((file) => file.path).sort()).toEqual([
      'generated/StorageNapiModule.ts',
      'shared/nativeModule/CMakeLists.txt',
      'shared/nativeModule/StorageNapiModule.cc',
    ].sort());
    expect(
      files.find((file) => file.path === 'shared/nativeModule/CMakeLists.txt')
        ?.overwrite,
    ).toBe(false);
    expect(
      files.find((file) =>
        file.path === 'shared/nativeModule/StorageNapiModule.cc'
      )?.content,
    ).toContain('LYNX_REGISTER_NATIVE_MODULE');
    expect(
      files.find((file) =>
        file.path === 'shared/nativeModule/StorageNapiModule.cc'
      )?.content,
    ).toContain('#include "napi.h"');
    expect(
      files.find((file) =>
        file.path === 'shared/nativeModule/StorageNapiModule.cc'
      )?.content,
    ).toContain(
      'Napi::Value GetValue(const Napi::CallbackInfo& info)',
    );
    expect(
      files.find((file) =>
        file.path === 'shared/nativeModule/StorageNapiModule.cc'
      )?.content,
    ).toContain('// Method:');
    expect(
      files.find((file) =>
        file.path === 'shared/nativeModule/StorageNapiModule.cc'
      )?.content,
    ).toContain('//   getValue(');
    expect(
      files.find((file) =>
        file.path === 'shared/nativeModule/StorageNapiModule.cc'
      )?.content,
    ).toContain('//     key: string,');
    expect(
      files.find((file) =>
        file.path === 'shared/nativeModule/StorageNapiModule.cc'
      )?.content,
    ).toContain('// types/napi-native-module.d.ts:4');
    expect(
      files.find((file) =>
        file.path === 'shared/nativeModule/StorageNapiModule.cc'
      )?.content,
    ).toContain('Napi::String key = info[0].As<Napi::String>();');
    expect(
      files.find((file) =>
        file.path === 'shared/nativeModule/StorageNapiModule.cc'
      )?.content,
    ).toContain('Napi::String value = info[1].As<Napi::String>();');
    expect(
      files.find((file) =>
        file.path === 'shared/nativeModule/StorageNapiModule.cc'
      )?.content,
    ).toContain('Napi::Object options = info[0].As<Napi::Object>();');
    expect(
      files.find((file) =>
        file.path === 'shared/nativeModule/StorageNapiModule.cc'
      )?.content,
    ).toContain('Napi::Array items = info[1].As<Napi::Array>();');
    expect(
      files.find((file) =>
        file.path === 'shared/nativeModule/StorageNapiModule.cc'
      )?.content,
    ).toContain('Napi::Function callback = info[2].As<Napi::Function>();');
    expect(
      files.find((file) =>
        file.path === 'shared/nativeModule/StorageNapiModule.cc'
      )?.content,
    ).toContain('Napi::ArrayBuffer data = info[3].As<Napi::ArrayBuffer>();');
    expect(
      files.find((file) =>
        file.path === 'shared/nativeModule/StorageNapiModule.cc'
      )?.content,
    ).toContain('Napi::Uint8Array bytes = info[4].As<Napi::Uint8Array>();');
    expect(
      files.find((file) =>
        file.path === 'shared/nativeModule/StorageNapiModule.cc'
      )?.content,
    ).toContain('// types/napi-native-module.d.ts:11');
    expect(
      files.find((file) =>
        file.path === 'shared/nativeModule/StorageNapiModule.cc'
      )?.content,
    ).toContain('// Param: metadata: Map<string, unknown>');
    expect(
      files.find((file) =>
        file.path === 'shared/nativeModule/StorageNapiModule.cc'
      )?.content,
    ).toContain('Napi::Object metadata = info[5].As<Napi::Object>();');
    expect(
      files.find((file) =>
        file.path === 'shared/nativeModule/StorageNapiModule.cc'
      )?.content,
    ).toContain('return Napi::Promise::Deferred::New(env).Promise();');
    expect(
      files.find((file) =>
        file.path === 'shared/nativeModule/StorageNapiModule.cc'
      )?.content,
    ).not.toContain('std::');
    expect(
      files.find((file) =>
        file.path === 'shared/nativeModule/StorageNapiModule.cc'
      )?.content,
    ).not.toContain('class StorageNapiModule');
  });

  it('separates platform and NAPI native module typings', () => {
    const root = createFixture({
      manifest: {
        platforms: {
          android: {
            packageName: 'com.example.storage',
          },
          ios: {},
          lynxtron: {
            path: 'dist',
          },
        },
      },
      types: '',
    });
    writeTypesFile(
      root,
      'platform-native-module.d.ts',
      `/** @lynxmodule */
export declare class StoragePlatformModule {
  clear(): void;
}
`,
    );
    writeTypesFile(
      root,
      'napi-native-module.d.ts',
      `/** @lynxmodule */
export declare class StorageNapiModule {
  clear(): void;
}
`,
    );

    const files = generate({ root });
    const paths = files.map((file) => file.path);

    expect(paths).toContain('generated/StoragePlatformModule.ts');
    expect(paths).toContain(
      'android/src/main/java/com/example/storage/generated/StoragePlatformModuleSpec.java',
    );
    expect(paths).toContain('ios/src/generated/StoragePlatformModuleSpec.h');
    expect(paths).toContain('generated/StorageNapiModule.ts');
    expect(paths).toContain('shared/nativeModule/StorageNapiModule.cc');
    expect(paths).not.toContain(
      'android/src/main/java/com/example/storage/generated/StorageNapiModuleSpec.java',
    );
    expect(paths).not.toContain('ios/src/generated/StorageNapiModuleSpec.h');
  });

  it('writes generated files from a temp library package', () => {
    const root = createFixture({
      manifest: {
        platforms: {
          android: {
            packageName: 'com.example.storage',
            sourceDir: 'android',
          },
          ios: {
            sourceDir: 'ios',
          },
        },
      },
      types: `/** @lynxmodule */
export declare class StorageModule {
  clear(): void;
}
`,
    });

    const files = runCodegen({ root });

    expect(files).toHaveLength(4);
    expect(
      fs.readFileSync(path.join(root, 'generated/StorageModule.ts'), 'utf8'),
    ).toContain('export const StorageModule');
    expect(
      fs.existsSync(
        path.join(
          root,
          'android/src/main/java/com/example/storage/generated/StorageModuleSpec.java',
        ),
      ),
    ).toBe(true);
  });

  it('does not overwrite user-owned NAPI native module stubs', () => {
    const root = createFixture({
      manifest: {
        platforms: {
          lynxtron: {
            path: 'dist',
          },
        },
      },
      types: '',
    });
    writeTypesFile(
      root,
      'napi-native-module.d.ts',
      `/** @lynxmodule */
export declare class StorageNapiModule {
  clear(): void;
}
`,
    );
    fs.mkdirSync(path.join(root, 'shared/nativeModule'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'shared/nativeModule/StorageNapiModule.cc'),
      'custom implementation\n',
    );

    runCodegen({ root });

    expect(
      fs.readFileSync(
        path.join(root, 'shared/nativeModule/StorageNapiModule.cc'),
        'utf8',
      ),
    ).toBe('custom implementation\n');
    expect(
      fs.existsSync(
        path.join(
          root,
          'shared/nativeModule/CMakeLists.txt',
        ),
      ),
    ).toBe(true);
  });

  it('rejects generated paths that escape the package root', () => {
    const root = createFixture({
      manifest: {
        platforms: {
          android: {
            packageName: 'com.example.storage',
            sourceDir: '../outside',
          },
          ios: {
            sourceDir: 'ios',
          },
        },
      },
      types: `/** @lynxmodule */
export declare class StorageModule {
  clear(): void;
}
`,
    });
    const outside = path.resolve(root, '../outside');

    expect(() => runCodegen({ root })).toThrow(
      /Generated path escapes package root/,
    );
    expect(fs.existsSync(path.join(root, 'generated/StorageModule.ts'))).toBe(
      false,
    );
    expect(fs.existsSync(outside)).toBe(false);
  });

  it.runIf(process.platform !== 'win32')(
    'rejects generated paths that traverse symlinks',
    () => {
      const root = createFixture({
        manifest: {
          platforms: {
            android: {
              packageName: 'com.example.storage',
              sourceDir: 'android',
            },
            ios: {
              sourceDir: 'ios',
            },
          },
        },
        types: `/** @lynxmodule */
export declare class StorageModule {
  clear(): void;
}
`,
      });
      const outside = createTempDir();
      fs.symlinkSync(outside, path.join(root, 'android'), 'dir');

      expect(() => runCodegen({ root })).toThrow(
        /Generated path escapes package root via symlink: android/,
      );
      expect(fs.existsSync(path.join(root, 'generated/StorageModule.ts'))).toBe(
        false,
      );
      expect(
        fs.existsSync(
          path.join(
            outside,
            'src/main/java/com/example/storage/generated/StorageModuleSpec.java',
          ),
        ),
      ).toBe(false);
    },
  );

  it('fails clearly when lynx.lib.json is missing', () => {
    const root = createTempDir();
    fs.mkdirSync(path.join(root, 'types'), { recursive: true });

    expect(() => generate({ root })).toThrow(/Missing lynx\.lib\.json/);
  });

  it('fails clearly when android packageName is missing', () => {
    const root = createFixture({
      manifest: {
        platforms: {
          android: {},
          ios: {},
        },
      },
      types: '',
    });

    expect(() => generate({ root })).toThrow(
      /platforms\.android\.packageName/,
    );
  });

  it('fails clearly when no Native platform is configured', () => {
    const root = createFixture({
      manifest: {
        platforms: {},
      },
      types: '',
    });

    expect(() => generate({ root })).toThrow(/at least one Native platform/);
  });

  it('fails clearly when android packageName is not a Java package identifier', () => {
    const root = createFixture({
      manifest: {
        platforms: {
          android: {
            packageName: 'com..example',
          },
          ios: {},
        },
      },
      types: '',
    });

    expect(() => generate({ root })).toThrow(
      /platforms\.android\.packageName.*valid Java package identifier/,
    );
  });

  it('fails clearly when optional sourceDir values are invalid', () => {
    const root = createFixture({
      manifest: {
        platforms: {
          android: {
            packageName: 'com.example.storage',
            sourceDir: '',
          },
          ios: {},
        },
      },
      types: '',
    });

    expect(() => generate({ root })).toThrow(
      /platforms\.android\.sourceDir/,
    );
  });

  it('fails clearly for unsupported native module types', () => {
    expect(() =>
      parseNativeModules(
        `/** @lynxmodule */
export declare class BadModule {
  setValue(value: WeakRef<string>): void;
}
`,
        'types/index.d.ts',
      )
    ).toThrow(/Unsupported type "WeakRef<string>"/);
  });

  it('fails clearly when a parameter uses void', () => {
    expect(() =>
      parseNativeModules(
        `/** @lynxmodule */
export declare class BadModule {
  setValue(value: void): void;
}
`,
        'types/index.d.ts',
      )
    ).toThrow(
      /Unsupported parameter type "void" for BadModule\.setValue\.value/,
    );
  });

  it('fails clearly for duplicate module names across files', () => {
    const root = createTempDir();
    writeJson(path.join(root, 'lynx.lib.json'), {
      platforms: {
        android: { packageName: 'com.example.dupe' },
        ios: {},
      },
    });
    fs.mkdirSync(path.join(root, 'types/a'), { recursive: true });
    fs.mkdirSync(path.join(root, 'types/b'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'types/a/index.d.ts'),
      `/** @lynxmodule */
export declare class DupeModule {
  a(): void;
}
`,
    );
    fs.writeFileSync(
      path.join(root, 'types/b/index.d.ts'),
      `/** @lynxmodule */
export declare class DupeModule {
  b(): void;
}
`,
    );

    expect(() => generate({ root })).toThrow(
      /Duplicate native module "DupeModule"/,
    );
  });
});

function createFixture(options: {
  manifest: unknown;
  types: string;
}): string {
  const root = createTempDir();
  writeJson(path.join(root, 'lynx.lib.json'), options.manifest);
  fs.mkdirSync(path.join(root, 'types'), { recursive: true });
  fs.writeFileSync(path.join(root, 'types/index.d.ts'), options.types);
  return root;
}

function writeTypesFile(root: string, file: string, source: string): void {
  const target = path.join(root, 'types', file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source);
}

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lynx-autolink-codegen-'));
  tempDirs.push(dir);
  return dir;
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
