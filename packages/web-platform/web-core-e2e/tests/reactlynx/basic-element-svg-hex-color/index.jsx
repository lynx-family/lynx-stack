// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
function App() {
  return (
    <svg
      content='<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6.75 1.75C6.75 1.33579 6.41421 1 6 1C5.58579 1 5.25 1.33579 5.25 1.75V5.25H1.75C1.33579 5.25 1 5.58579 1 6C1 6.41421 1.33579 6.75 1.75 6.75H5.25V10.25C5.25 10.6642 5.58579 11 6 11C6.41421 11 6.75 10.6642 6.75 10.25V6.75H10.25C10.6642 6.75 11 6.41421 11 6C11 5.58579 10.6642 5.25 10.25 5.25H6.75V1.75Z" fill="#161823"/></svg>'
      style='height:492px; width:188px;'
    >
    </svg>
  );
}
root.render(<App></App>);
