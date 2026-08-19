// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { expect, test } from '@rstest/core';

import type { ButtonProps } from '../src/catalog/Button/index.jsx';
import type { A2UIFunctionCall, V1FunctionCall } from '../src/index.js';
import type { ServerToClientMessage } from '../src/store/types.js';

const validV1: ServerToClientMessage = {
  version: 'v1.0',
  updateDataModel: { surfaceId: 'surface', value: null },
};

const validLegacy: ServerToClientMessage = {
  createSurface: {
    surfaceId: 'legacy',
    theme: { primaryColor: '#fff' },
  },
};

const validV1FunctionCall: V1FunctionCall = {
  call: 'currentTime',
};

const validCatalogFunctionCall: ButtonProps['action'] = {
  functionCall: {
    call: 'refresh',
    catalogId: 'example-catalog',
  },
};

const validLegacyFunctionCall: A2UIFunctionCall = {
  call: 'legacyFormat',
  args: { value: 1 },
  returnType: 'string',
};

const invalidV1FunctionCall: V1FunctionCall = {
  call: 'legacyFormat',
  // @ts-expect-error v1.0 function calls do not carry a returnType.
  returnType: 'string',
};

// @ts-expect-error v1.0 requires updateDataModel.value to be present.
const invalidV1MissingValue: ServerToClientMessage = {
  version: 'v1.0',
  updateDataModel: { surfaceId: 'surface' },
};

// @ts-expect-error theme is a legacy v0.9 createSurface field.
const invalidV1Theme: ServerToClientMessage = {
  version: 'v1.0',
  createSurface: {
    surfaceId: 'surface',
    theme: { primaryColor: '#fff' },
  },
};

test('message types discriminate v1.0 from legacy input', () => {
  expect(validV1.version).toBe('v1.0');
  expect(validLegacy.version).toBeUndefined();
  expect(validV1FunctionCall.args).toBeUndefined();
  expect(validCatalogFunctionCall.functionCall.catalogId).toBe(
    'example-catalog',
  );
  expect(validLegacyFunctionCall.returnType).toBe('string');
  void invalidV1MissingValue;
  void invalidV1Theme;
  void invalidV1FunctionCall;
});
