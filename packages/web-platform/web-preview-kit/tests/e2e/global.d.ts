// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  EventName,
  FileMap,
  HelloInfo,
  PreviewClient,
  ProjectConfig,
  ResponseMessage,
} from '../../src/client/index.js';
import type { connectPreview } from '../../src/client/index.js';

declare global {
  interface Window {
    /** The demo host (`demo/main.ts`). */
    demo: {
      ready: Promise<PreviewClient>;
      events: { event: EventName; data: unknown }[];
      sampleFiles: FileMap;
      sampleConfig: ProjectConfig;
      connectPreview: typeof connectPreview;
    };
    /** The helper the tests install in the kit page (`harness.ts`). */
    kit: {
      /** The `hello` of the first session. */
      ready: Promise<HelloInfo>;
      /** Every event of every session, in order. */
      events: { event: EventName; data: unknown }[];
      /** Every message with an id that arrived on the port. */
      responses: unknown[];
      /** Every `ready` message the page received. */
      readies: unknown[];
      /** Opens another session on a new port; resolves to its `hello`. */
      connect(): Promise<HelloInfo>;
      /** Sends a request with the next id; resolves to its response. */
      request(method: string, params: unknown): Promise<ResponseMessage>;
      /** Posts any message on the port. */
      send(message: unknown): void;
    };
  }
}
