// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  ImageContent,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';
import type { McpContext } from './McpContext.ts';
import type { ImageContentData, Response } from './tools/defineTool.ts';

export class McpResponse implements Response {
  #includeDevices = false;
  setIncludeDevices(value: boolean): void {
    this.#includeDevices = value;
  }

  #deviceId: string | undefined;

  #includeClients = false;
  setIncludeClients(value: boolean, deviceId?: string): void {
    this.#includeClients = value;
    this.#deviceId = deviceId;
  }

  #additionalLines: string[] = [];
  appendLines(...lines: string[]): void {
    this.#additionalLines.push(...lines);
  }

  #images: ImageContentData[] = [];
  attachImage(value: ImageContentData): void {
    this.#images.push(value);
  }

  async handle(
    toolName: string,
    context: McpContext,
  ): Promise<Array<TextContent | ImageContent>> {
    const connector = context.connector();

    const responses: string[] = [`# ${toolName} response`];

    if (this.#includeDevices) {
      const devices = Array.from(connector.devices.entries())
        .map(([id, device]) =>
          `- ${id}: ${device.info.os}, ${device.info.title}`
        );

      responses.push('## Devices', devices.join('\n'));
    }

    if (this.#includeClients) {
      const clients = (this.#deviceId
        ? (await connector.getDeviceUsbClients(this.#deviceId))
        : connector.getAllUsbClients())
        .map(client =>
          `- ${client.clientId()}: ${client.info.query.app} (${client.info.query.device})`
        );
      responses.push('## Clients', clients.join('\n'));
    }

    return [
      {
        type: 'text',
        text: responses.concat(this.#additionalLines).join('\n'),
      },
      ...this.#images.map(img => ({
        type: 'image' as const,
        ...img,
      })),
    ];
  }
}
