// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { transformReactLynx } from '../main.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const crateRoot = path.resolve(
  dirname,
  '../crates/swc_plugin_worklet',
);

const declarations = {
  protocolVersion: 1,
  modules: [
    {
      source: 'fake-receiver',
      package: 'fake-receiver',
      packageVersion: '1.0.0',
      manifest: 'directive-inference.json',
      exports: {
        consume: {
          args: {
            0: true,
            1: { nested: '**' },
          },
        },
        mark: { marker: true },
        'widgets.Panel': {
          props: {
            callback: true,
          },
        },
      },
    },
  ],
};

function options(target, extra = {}) {
  return {
    mode: 'test',
    pluginName: 'directive-inference-test',
    filename: 'src/input.tsx',
    sourcemap: false,
    cssScope: false,
    snapshot: false,
    dynamicImport: false,
    directiveDCE: false,
    defineDCE: false,
    shake: false,
    compat: false,
    worklet: {
      target,
      filename: 'src/input.tsx',
      runtimePkg: '@lynx-js/react/internal',
    },
    directiveInference: declarations,
    refresh: false,
    ...extra,
  };
}

describe('native directive inference contract', () => {
  it('produces deterministic records and definitions across JS and LEPUS', async () => {
    const source = `
      import receiver, { consume as renamed } from "fake-receiver";
      import * as api from "fake-receiver";

      renamed(
        (value) => value * 2,
        { nested: [() => 1, { finish() { return 2 } }] },
      );
      api.widgets.Panel({
        callback: function () { return 3 },
      });
      receiver;
    `;

    const [background, mainThread] = await Promise.all([
      transformReactLynx(source, options('JS')),
      transformReactLynx(source, options('LEPUS')),
    ]);

    expect(background.errors).toEqual([]);
    expect(mainThread.errors).toEqual([]);
    expect(background.warnings).toEqual([]);
    expect(mainThread.warnings).toEqual([]);
    expect(background.directiveInferenceRecords).toEqual(
      mainThread.directiveInferenceRecords,
    );
    expect(background.directiveInferenceRecords.map(record => record.path))
      .toEqual([
        'args.0',
        'args.1.nested.0',
        'args.1.nested.1.finish',
      ]);
    expect(background.definesForWorklet).toEqual(
      mainThread.definesForWorklet,
    );
    expect(background.definesForWorklet).toHaveLength(3);
  });

  it('uses the marker declaration and respects file opt-out', async () => {
    const markedSource = `
        import { mark as tagged } from "fake-receiver";
        const callback = tagged((value) => value);
      `;
    const marked = await transformReactLynx(markedSource, options('JS'));
    expect(marked.errors).toEqual([]);
    expect(marked.directiveInferenceRecords).toHaveLength(1);
    expect(marked.directiveInferenceRecords[0]?.path).toBe('marker.0');
    // Record offsets are file-local and zero-based: they slice the inferred
    // function literal out of the input source.
    const record = marked.directiveInferenceRecords[0];
    expect(markedSource.slice(record.start, record.end)).toBe(
      '(value) => value',
    );
    expect(marked.definesForWorklet).toHaveLength(1);

    const optedOut = await transformReactLynx(
      `
        "use no main thread";
        import { mark as tagged } from "fake-receiver";
        const callback = tagged((value) => value);
      `,
      options('JS'),
    );
    expect(optedOut.errors).toEqual([]);
    expect(optedOut.directiveInferenceRecords).toEqual([]);
    expect(optedOut.definesForWorklet).toEqual([]);
  });

  it('warns with a source location for indirect values', async () => {
    const result = await transformReactLynx(
      `
        import { consume } from "fake-receiver";
        const callback = () => 1;
        consume(callback, { nested: [() => 2, ...callbacks] });
      `,
      options('JS'),
    );

    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(2);
    for (const warning of result.warnings) {
      expect(warning.text).toMatch(
        /Inline a function literal or add the directive explicitly/,
      );
      expect(warning.location).toMatchObject({
        file: 'src/input.tsx',
        line: expect.any(Number),
        column: expect.any(Number),
      });
    }
    expect(result.directiveInferenceRecords.map(record => record.path))
      .toEqual(['args.1.nested.0']);
  });

  it('does not infer from type-only imports or shadowed bindings', async () => {
    const result = await transformReactLynx(
      `
        import type { consume as TypeOnly } from "fake-receiver";
        import { consume } from "fake-receiver";
        function local(consume) {
          consume(() => 1);
        }
        consume(() => 2);
      `,
      options('JS'),
    );

    expect(result.errors).toEqual([]);
    expect(result.directiveInferenceRecords).toHaveLength(1);
    expect(result.code.match(/_wkltId/g)).toHaveLength(1);
  });
});

describe('directive-inference policy audit', () => {
  it('contains no receiving API names in production Rust source', () => {
    const manifests = [
      JSON.parse(
        fs.readFileSync(path.resolve(dirname, '../../directive-inference.json')),
      ),
      JSON.parse(
        fs.readFileSync(
          path.resolve(dirname, '../../../motion/directive-inference.json'),
        ),
      ),
    ];
    const forbidden = manifests.flatMap(manifest => Object.keys(manifest.exports));
    const source = fs.readdirSync(crateRoot, { recursive: true })
      .filter(filename =>
        typeof filename === 'string'
        && filename.endsWith('.rs')
        && !filename.includes(`${path.sep}tests${path.sep}`)
        && fs.statSync(path.join(crateRoot, filename)).isFile()
      )
      .map(filename => fs.readFileSync(path.join(crateRoot, filename), 'utf8'))
      .join('\n');

    for (const name of forbidden) {
      expect(source).not.toContain(name);
    }
  });
});
