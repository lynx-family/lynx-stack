// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expectTypeOf, test } from 'vitest';

interface ExistingInterface {
  somePropertyFromExistingInterface: number;
}

declare module '@lynx-js/react' {
  interface InitDataRaw extends ExistingInterface {
    someAnotherCustomProperty: string;
  }

  interface InitData {
    changedSomePropertyFromExistingInterface: number;
    changedSomeAnotherCustomProperty: string;
  }
}

test('defaultDataProcessor', () => {
  lynx.registerDataProcessors({
    defaultDataProcessor(rawInitData) {
      expectTypeOf(rawInitData).toHaveProperty(
        'somePropertyFromExistingInterface',
      ).toBeNumber();
      expectTypeOf(rawInitData).toHaveProperty('someAnotherCustomProperty')
        .toBeString();

      return {
        changedSomeAnotherCustomProperty: rawInitData.someAnotherCustomProperty,
        changedSomePropertyFromExistingInterface:
          rawInitData.somePropertyFromExistingInterface,
      };
    },
  });
});

test('dataProcessors', () => {
  interface Foo {
    data: unknown;
  }

  lynx.registerDataProcessors({
    dataProcessors: {
      getScreenMetricsOverride(metrics) {
        expectTypeOf(metrics).toHaveProperty('width').toBeNumber();
        expectTypeOf(metrics).toHaveProperty('height').toBeNumber();
        return metrics;
      },

      unknownProcessor(foo: Foo) {
        return foo.data;
      },
    },
  });

  lynx.registerDataProcessors({});
  lynx.registerDataProcessors({
    dataProcessors: {},
  });
  lynx.registerDataProcessors({
    dataProcessors: {
      foo() {
        return 42;
      },
    },
  });
});
