// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { sExportsLegacyReactRuntime, target } from './target';

export const {
  Component,
  PureComponent,
  __runInJS,
  createContext,
  createRef,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} = target[sExportsLegacyReactRuntime];

export default target[sExportsLegacyReactRuntime]['default'];
