// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  EventName,
  FileMap,
  PreviewClient,
  ProjectConfig,
} from '../../src/client/index.js';

declare global {
  interface Window {
    demo: {
      ready: Promise<PreviewClient>;
      events: { event: EventName; data: unknown }[];
      sampleFiles: FileMap;
      sampleConfig: ProjectConfig;
    };
  }
}
