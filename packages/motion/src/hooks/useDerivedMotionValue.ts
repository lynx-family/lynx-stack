// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { MotionValue, SpringOptions } from 'motion-dom';

import {
  runOnMainThread,
  useEffect,
  useMainThreadRef,
  useRef,
} from '@lynx-js/react';

import { motionValueType, useMotionValue } from './useMotionValue.js';
import {
  attachSpring,
  mapValue,
  transformValue,
} from '../upstream/full.js' with { runtime: 'shared' };

export type MotionScalar = number | string;
export type ScalarValue =
  | MotionValue<number>
  | MotionValue<string>
  | MotionValue<MotionScalar>;
export type MotionInput = MotionScalar | ScalarValue;

type Derivation =
  | {
    kind: 'map';
    source: MotionValue<number>;
    input: number[];
    output: MotionScalar[];
    clamp: boolean;
  }
  | {
    kind: 'spring';
    source: MotionInput;
    options: SpringOptions;
  }
  | {
    kind: 'template';
    fragments: string[];
    values: MotionInput[];
  };

export function readInitialMotionInput(value: MotionInput): MotionScalar {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }

  const handle = motionValueType.downcast(value);
  if (handle === undefined) {
    throw new Error('Expected a MotionValue from a ReactLynx Motion hook.');
  }
  return handle.creationPayload as MotionScalar;
}

export function useDerivedMotionValue<T extends MotionScalar>(
  initial: T,
  derivation: Derivation,
): MotionValue<T> {
  const output = useMotionValue(initial);
  const dispose = useMainThreadRef<(() => void) | null>(null);
  const installedKey = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Handles serialize their stable identity. Inline ranges, spring options
    // and template arguments can therefore stay stable across React commits.
    const key = JSON.stringify(derivation);
    if (installedKey.current === key) return;
    installedKey.current = key;

    function install() {
      'main thread';
      dispose.current?.();
      const input = derivation;
      const target = output as unknown as MotionValue<MotionScalar>;
      if (input.kind === 'spring') {
        const source = input.source as MotionScalar | MotionValue<MotionScalar>;
        const detach = attachSpring(target, source, input.options);
        if (typeof source === 'object') target.set(source.get());
        dispose.current = () => {
          detach();
          target.stop();
          target.attach((next, set) => set(next), () => {
            // The passthrough has no animation to stop.
          });
        };
        return;
      }

      const value = input.kind === 'map'
        ? mapValue(input.source, input.input, input.output, {
          clamp: input.clamp,
        })
        : transformValue<MotionScalar>(() =>
          input.fragments.map((fragment, index) => {
            const part = input.values[index];
            return fragment
              + (typeof part === 'object' ? part.get() : part ?? '');
          }).join('')
        );

      target.set(value.get());
      const unsubscribe = value.on('change', next => {
        target.set(next);
      });
      dispose.current = () => {
        unsubscribe();
        value.destroy();
      };
    }

    void runOnMainThread(install)();
  });

  useEffect(() => {
    function uninstall() {
      'main thread';
      dispose.current?.();
      dispose.current = null;
    }

    return () => {
      installedKey.current = undefined;
      void runOnMainThread(uninstall)();
    };
  }, [dispose]);

  return output;
}
