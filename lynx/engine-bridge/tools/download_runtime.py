#!/usr/bin/env python3
# Copyright 2026 The Lynx Authors. All rights reserved.
# Licensed under the Apache License Version 2.0 that can be found in the
# LICENSE file in the root directory of this source tree.

import argparse
import os
import platform
import shlex
import subprocess
import sys
import time
import urllib.request
from pathlib import Path


MACOS_RUNTIME_URL = (
    'https://github.com/PupilTong/playground/releases/download/'
    'lynx-runtime-clay-manual-0.0.1/libLynx_clay.dylib')


def _log(message):
  print(message, file=sys.stderr)


def _default_library_name():
  system = platform.system()
  if system == 'Darwin':
    return 'libLynx_clay.dylib'
  if system == 'Linux':
    return 'libLynx_clay.so'
  raise RuntimeError(f'unsupported Lynx runtime target: {system}')


def _default_runtime_url(library_name):
  configured = os.environ.get('LYNX_RUNTIME_URL')
  if configured:
    return configured
  if library_name.endswith('.dylib'):
    return MACOS_RUNTIME_URL
  raise RuntimeError(
      'no default Lynx runtime URL is configured for this platform; '
      'pass --url or set LYNX_RUNTIME_URL')


def _download(url, destination, retries, force):
  destination.parent.mkdir(parents=True, exist_ok=True)
  if destination.is_file() and destination.stat().st_size > 0 and not force:
    _log(f'Using existing Lynx runtime at {destination}')
    return

  tmp_destination = destination.with_suffix(f'{destination.suffix}.{os.getpid()}.tmp')
  for attempt in range(1, retries + 1):
    try:
      _log(f'Downloading {url} -> {destination}')
      with urllib.request.urlopen(url, timeout=60) as response:
        with open(tmp_destination, 'wb') as output:
          output.write(response.read())
      os.replace(tmp_destination, destination)
      return
    except Exception as error:
      if tmp_destination.exists():
        tmp_destination.unlink()
      if attempt == retries:
        raise
      _log(f'Download failed on attempt {attempt}/{retries}: {error}')
      time.sleep(min(attempt * 2, 10))


def _adhoc_sign_if_needed(sdk_dir):
  if platform.system() != 'Darwin':
    return
  script = Path(__file__).with_name('adhoc_sign_macos_sdk.py')
  subprocess.check_call([sys.executable, str(script), str(sdk_dir)])


def main():
  repo_default_sdk = Path(__file__).resolve().parents[1] / 'target' / 'lynx-engine-bridge-sdk'
  parser = argparse.ArgumentParser(
      description='Download the dynamic Lynx runtime used by engine-bridge tests.')
  parser.add_argument(
      '--sdk-dir',
      default=os.environ.get('LYNX_SDK_DIR', str(repo_default_sdk)),
      help='SDK directory to populate. Defaults to %(default)s.')
  parser.add_argument(
      '--url',
      default=None,
      help='Runtime library URL. Defaults to LYNX_RUNTIME_URL or the macOS fixture URL.')
  parser.add_argument(
      '--library-name',
      default=None,
      help='Runtime library filename. Defaults to the platform filename.')
  parser.add_argument(
      '--retries',
      type=int,
      default=5,
      help='Download retry count. Defaults to %(default)s.')
  parser.add_argument(
      '--force',
      action='store_true',
      help='Download even when the runtime library already exists.')
  parser.add_argument(
      '--emit-env',
      action='store_true',
      help='Print an export command for LYNX_SDK_DIR on stdout.')
  parser.add_argument(
      '--github-env',
      default=None,
      help='Append LYNX_SDK_DIR to this GitHub Actions environment file.')
  args = parser.parse_args()

  library_name = args.library_name or _default_library_name()
  url = args.url or _default_runtime_url(library_name)
  sdk_dir = Path(args.sdk_dir).expanduser().resolve()
  destination = sdk_dir / 'lib' / library_name

  _download(url, destination, args.retries, args.force)
  _adhoc_sign_if_needed(sdk_dir)

  _log(f'Lynx runtime SDK is ready at {sdk_dir}')
  if args.github_env:
    with open(args.github_env, 'a', encoding='utf-8') as github_env:
      github_env.write(f'LYNX_SDK_DIR={sdk_dir}\n')
  if args.emit_env:
    print(f'export LYNX_SDK_DIR={shlex.quote(str(sdk_dir))}')


if __name__ == '__main__':
  try:
    main()
  except Exception as error:
    print(f'Failed to download Lynx runtime: {error}', file=sys.stderr)
    sys.exit(1)
