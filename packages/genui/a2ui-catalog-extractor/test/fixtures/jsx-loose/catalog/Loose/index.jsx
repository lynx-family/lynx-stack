// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/**
 * @typedef {object} LooseProps
 * @property {Map<string, string>} value Unsupported types fall back to string in JSX mode.
 */

/**
 * @param {LooseProps} props Loose props.
 */
export function Loose(props) {
  return props;
}
