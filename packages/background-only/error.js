// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
throw new Error(
  'This module cannot be imported from a Main Thread module. '
    + 'It should only be used from a Background Thread.',
);
