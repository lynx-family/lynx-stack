import {
  mainThreadObjectDefinition as usedDefinition,
} from '@lynx-js/react/internal/main-thread-object-definition?type=40746573742f75736564&create=757365642d637265617465&dispose=757365642d646973706f7365';
import {
  mainThreadObjectDefinition as unusedDefinition,
} from '@lynx-js/react/internal/main-thread-object-definition?type=40746573742f756e75736564&create=756e757365642d637265617465&dispose=';
import { defineMainThreadObjectType } from '@lynx-js/react';

export const usedType = /*#__PURE__*/ defineMainThreadObjectType(
  {
    type: '@test/used',
    create: { _wkltId: 'used-create' },
    dispose: { _wkltId: 'used-dispose' },
  },
  usedDefinition,
);
export const unusedType = /*#__PURE__*/ defineMainThreadObjectType(
  { type: '@test/unused', create: { _wkltId: 'unused-create' } },
  unusedDefinition,
);
