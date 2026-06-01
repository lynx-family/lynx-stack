// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Element Template-only root for renderPage.
 */
let __root: {
  __jsx?: React.ReactNode;
  __opcodes?: any[];
  nodeType?: Element['nodeType'];
};

function setRoot(root: typeof __root): void {
  __root = root;

  // A fake ELEMENT_NODE to make preact/debug happy.
  if (__DEV__ && __root) {
    __root.nodeType = 1;
  }
}

setRoot({});

export { __root, setRoot };
