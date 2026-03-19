// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  ImageContent,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';
import type { ImageContentData, Response } from './tools/defineTool.ts';

export class McpResponse implements Response {
  #includeResponseTitle = true;
  setIncludeResponseTitle(value: boolean): void {
    this.#includeResponseTitle = value;
  }

  #additionalLines: string[] = [];
  appendLines(...lines: string[]): void {
    this.#additionalLines.push(...lines);
  }

  #images: ImageContentData[] = [];
  attachImage(value: ImageContentData): void {
    this.#images.push(value);
  }

  async handle(toolName: string): Promise<Array<TextContent | ImageContent>> {
    const responses: string[] = [];

    if (this.#includeResponseTitle) {
      responses.push(`# ${toolName} response`);
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
