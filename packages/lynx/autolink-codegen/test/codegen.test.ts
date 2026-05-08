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
      'types/index.d.ts',
    );

    expect(modules).toEqual([
      {
        name: 'StorageModule',
        methods: [
          {
            name: 'setValue',
            params: [
              { name: 'key', type: { name: 'string', nullable: false } },
              { name: 'value', type: { name: 'string', nullable: false } },
            ],
            returnType: { name: 'void', nullable: false },
          },
          {
            name: 'getValue',
            params: [
              { name: 'key', type: { name: 'string', nullable: false } },
            ],
            returnType: { name: 'string', nullable: true },
          },
          {
            name: 'hasValue',
            params: [
              { name: 'key', type: { name: 'string', nullable: false } },
            ],
            returnType: { name: 'boolean', nullable: false },
          },
          {
            name: 'score',
            params: [],
            returnType: { name: 'number', nullable: false },
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

    expect(files.map((file) => file.path)).toEqual([
      'generated/StorageModule.ts',
      'android/src/main/java/com/example/storage/generated/StorageModuleSpec.java',
      'ios/src/generated/StorageModuleSpec.h',
      'ios/src/generated/StorageModuleSpec.m',
    ]);
    expect(files[0]?.content).toContain('NativeModules.StorageModule');
    expect(files[1]?.content).toContain(
      'package com.example.storage.generated;',
    );
    expect(files[1]?.content).toContain('public abstract void setValue');
    expect(files[2]?.content).toContain('@protocol StorageModuleSpec');
    expect(files[2]?.content).toContain(
      '- (nullable NSString *)getValue:(NSString *)key;',
    );
  });

  it('writes generated files from a temp extension package', () => {
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
    expect(fs.existsSync(outside)).toBe(false);
  });

  it('fails clearly when lynx.ext.json is missing', () => {
    const root = createTempDir();
    fs.mkdirSync(path.join(root, 'types'), { recursive: true });

    expect(() => generate({ root })).toThrow(/Missing lynx\.ext\.json/);
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

  it('fails clearly for unsupported native module types', () => {
    expect(() =>
      parseNativeModules(
        `/** @lynxmodule */
export declare class BadModule {
  setValue(value: string[]): void;
}
`,
        'types/index.d.ts',
      )
    ).toThrow(/Unsupported type "string\[\]"/);
  });

  it('fails clearly for duplicate module names across files', () => {
    const root = createTempDir();
    writeJson(path.join(root, 'lynx.ext.json'), {
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
  writeJson(path.join(root, 'lynx.ext.json'), options.manifest);
  fs.mkdirSync(path.join(root, 'types'), { recursive: true });
  fs.writeFileSync(path.join(root, 'types/index.d.ts'), options.types);
  return root;
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
