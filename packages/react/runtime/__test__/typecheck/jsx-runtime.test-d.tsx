// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { assertType, describe, test } from 'vitest';
import { JSX } from '../../jsx-runtime/index';
import React from 'react';

describe('JSX Runtime Types', () => {
  test('should support basic JSX element', () => {
    const viewEle = <view></view>;
    assertType<JSX.Element>(viewEle);
  });

  test('should validate the required props for raw-text', () => {
    // @ts-expect-error: Missing required prop 'text'
    const shouldError = <raw-text></raw-text>;

    const rawTextELe = <raw-text text={'text'}></raw-text>;
    assertType<JSX.Element>(rawTextELe);
  });
});
