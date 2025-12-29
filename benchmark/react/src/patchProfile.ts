// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { PREFIX, hook } from './hook.js';

const ignored: Record<string, boolean> = {};
const stack: string[] = [];
let depth = 0;

if (typeof Codspeed !== 'undefined') {
  function shouldIgnoreBenchmark(name: string | undefined) {
    if (
      !name
      || name === 'ReactLynx::commit'
      || name === 'ReactLynx::commitChanges'
      || name === 'ReactLynx::transferRoot'
      || name === 'ReactLynx::BSI::setAttribute'
      || name.startsWith('OnLifecycleEvent::')
      || name.startsWith('ReactLynx::diff::')
      || name.startsWith('ReactLynx::render::')
    ) {
      return true;
    }
    return false;
  }

  hook(lynx.performance, 'profileStart', (old, name, option) => {
    old!.call(lynx.performance, name, option);
    if ((ignored[name] ??= shouldIgnoreBenchmark(name))) {
      stack.push('__IGNORED__');
    } else {
      stack.push(name);
      depth++;
      if (depth > 1) {
        console.log(
          `Benchmark ${name} is ignored because it is nested, the stack: ${
            stack.join(', ')
          }`,
        );
      } else {
        Codspeed.startBenchmark();
      }
    }
  });

  hook(lynx.performance, 'profileEnd', (old) => {
    const name = stack.pop()!;
    if (name === '__IGNORED__') {
      // Codspeed.zeroStats();
    } else {
      if (depth > 1) {
        // ignored
      } else {
        Codspeed.stopBenchmark();
        Codspeed.setExecutedBenchmark(
          `${PREFIX}::${__webpack_chunkname__}-${
            name
              .replace(/^ReactLynx::/, '')
              .replace(/::/g, '__')
          }`,
        );
      }
      depth--;
    }
    old!.call(lynx.performance);
  });
}
