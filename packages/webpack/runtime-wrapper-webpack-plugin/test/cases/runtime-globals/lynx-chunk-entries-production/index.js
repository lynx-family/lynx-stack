/// <reference types="@rstest/core/globals" />

import { RuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

const entriesKey = RuntimeGlobals.lynxChunkEntries.slice('lynx.'.length);

expect(lynx).not.toHaveProperty(entriesKey);
