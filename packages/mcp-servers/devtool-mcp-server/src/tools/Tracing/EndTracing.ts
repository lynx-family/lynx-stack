// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { clientId } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';
import type { TracingComplete } from '../../connector.ts';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Writable } from 'node:stream';

type IOReadResponse = {
  data: string;
  eof: boolean;
};

export const EndTracing = /*#__PURE__*/ defineTool({
  name: 'Tracing_end',
  description: 'Stop trace events collection',
  schema: {
    clientId,
  },
  annotations: {
    readOnlyHint: false,
  },
  async handler({ params }, response, context) {
    const connector = context.connector();
    const sendIOReadMessage = (stream: number): Promise<IOReadResponse> => {
      return connector.sendCDPMessage<IOReadResponse>(
        params.clientId,
        -1,
        'IO.read',
        { handle: stream, size: 1024 * 1024 },
      );
    };
    const readStreamDataToFile = async (
      stream: number,
      filePath: string,
    ): Promise<void> => {
      const sourceStream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const message = await sendIOReadMessage(stream);

            if (message.data) {
              controller.enqueue(Buffer.from(message.data, 'base64'));
            }

            if (message.eof) {
              controller.close();
            }
          } catch (err) {
            controller.error(err);
          }
        },
      });

      const writeStream = fs.createWriteStream(filePath);
      const fileWritable = Writable.toWeb(writeStream);

      await sourceStream.pipeTo(fileWritable);
    };
    const { promise, resolve } = Promise.withResolvers<void>();

    const timer = setTimeout(() => {
      response.appendLines(
        'Loading trace data timeout, please try again later!',
      );
      connector.offCDPEvent('Tracing.tracingComplete', handleTraceComplete);
      resolve();
    }, 8000);

    const cleanup = () => {
      connector.offCDPEvent('Tracing.tracingComplete', handleTraceComplete);
      clearTimeout(timer);
    };
    const handleTraceComplete = async (
      _error: string | undefined,
      data: TracingComplete,
      clientId: number,
    ) => {
      if (params.clientId !== clientId) {
        return;
      }

      try {
        const stream = data.stream;

        const tempDir = os.tmpdir();
        const timestamp = Date.now();
        const tempFileName = `trace-${timestamp}.pftrace`;
        const tempFilePath = path.join(tempDir, tempFileName);
        await readStreamDataToFile(stream, tempFilePath);

        response.appendLines(
          `Trace completed successfully, trace file path: ${tempFilePath}`,
        );
      } catch (error) {
        response.appendLines(
          `Trace completed failed, ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      } finally {
        cleanup();
        resolve();
      }
    };

    connector.onCDPEvent('Tracing.tracingComplete', handleTraceComplete);
    await connector.sendCDPMessage(
      params.clientId,
      -1,
      'Tracing.end',
    );

    return promise;
  },
});
