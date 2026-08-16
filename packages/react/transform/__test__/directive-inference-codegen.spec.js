// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from 'vitest';

import { generateDirectiveInferenceManifest } from '../scripts/generate_directive_inference_manifest.mjs';

describe('directive-inference declaration codegen', () => {
  it('generates calls, markers, components, and structural paths', () => {
    const manifest = generateDirectiveInferenceManifest(`
      type MainThreadFn = unknown;
      type MainThreadDeep = unknown;
      type MainThreadCall<Args extends readonly unknown[]> = unknown;
      type MainThreadComponent<Props> = unknown;
      type MainThreadMarker = unknown;
      type ExternalOptions = unknown;
      type Transition = ExternalOptions & MainThreadDeep;
      type Template = ((value: number) => string) & MainThreadFn;

      interface CallbackProps {
        callback?: Template;
        transition?: Transition;
        options?: {
          nested?: MainThreadDeep;
          ordinary?: string;
        };
      }

      export interface DirectiveInferenceManifest {
        consume: MainThreadCall<[value: MainThreadFn, options?: CallbackProps]>;
        mark: MainThreadMarker;
        widgets: {
          Panel: MainThreadComponent<CallbackProps>;
        };
      }
    `);

    expect(manifest).toEqual({
      protocolVersion: 1,
      exports: {
        consume: {
          args: {
            0: true,
            1: {
              callback: true,
              options: {
                nested: '**',
              },
              transition: '**',
            },
          },
        },
        mark: {
          marker: true,
        },
        'widgets.Panel': {
          props: {
            callback: true,
            options: {
              nested: '**',
            },
            transition: '**',
          },
        },
      },
    });
  });

  it('rejects unrecognized top-level policy types', () => {
    expect(() =>
      generateDirectiveInferenceManifest(`
        export interface DirectiveInferenceManifest {
          consume: Function;
        }
      `)
    ).toThrow(/must use MainThreadCall/);
  });
});
