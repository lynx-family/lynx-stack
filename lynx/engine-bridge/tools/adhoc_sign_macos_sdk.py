#!/usr/bin/env python3
# Copyright 2026 The Lynx Authors. All rights reserved.
# Licensed under the Apache License Version 2.0 that can be found in the
# LICENSE file in the root directory of this source tree.

import os
import shutil
import subprocess
import sys


def _adhoc_sign_dylib(dylib):
  if os.environ.get('LYNX_SKIP_ADHOC_SIGN') == '1':
    print(f"Skip ad-hoc signing for {dylib}")
    return
  codesign = shutil.which('codesign')
  if not codesign:
    raise Exception(
        'codesign was not found; set LYNX_SKIP_ADHOC_SIGN=1 to skip signing')
  print(f"Ad-hoc signing {dylib}")
  subprocess.check_call([codesign, '--force', '--sign', '-', dylib])


try:
  sdk_dir = sys.argv[1]
  lib_dir = os.path.join(sdk_dir, 'lib')
  dylibs = [
      os.path.join(lib_dir, 'libLynx_clay.dylib'),
      os.path.join(sdk_dir, 'libLynx_clay.dylib'),
  ]
  signed = 0
  for dylib in dylibs:
    if os.path.exists(dylib):
      _adhoc_sign_dylib(dylib)
      signed += 1
  print(f"Successfully ad-hoc signed {signed} macOS Rust SDK dylib(s)")
except Exception as e:
  print(f"Failed to ad-hoc sign macOS Rust SDK dylibs: {e}")
  sys.exit(1)
