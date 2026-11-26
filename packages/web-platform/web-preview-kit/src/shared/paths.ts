// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Whether `path` is a project-relative path the protocol accepts: no leading
 * `/`, no backslash, no empty, `.` or `..` segment.
 */
export function isValidProjectPath(path: unknown): path is string {
  if (typeof path !== 'string' || path.length === 0) {
    return false;
  }
  if (path.includes('\\') || path.includes('\0')) {
    return false;
  }
  return path.split('/').every(segment =>
    segment !== '' && segment !== '.' && segment !== '..'
  );
}
