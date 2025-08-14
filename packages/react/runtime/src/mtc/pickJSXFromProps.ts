// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ReactNode } from 'react';

type JSXRecord = Record<string, {
  $$typeof: symbol;
  i: number;
}>;

function pickJSXfromProps(props): [ReactNode, JSXRecord] {
  // transform jsx to { $$typeof: Symbol, i: 0 } in Record
}
