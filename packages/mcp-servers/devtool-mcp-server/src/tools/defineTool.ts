// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type * as z from 'zod';
import type { DebugRouterConnector } from '../connector.ts';

export interface Request<Schema extends z.ZodRawShape> {
  params: z.objectOutputType<Schema, z.ZodTypeAny>;
}

export interface Response {
  setIncludeClients(value: boolean, deviceId?: string): void;
  setIncludeDevices(value: boolean): void;
  appendLines(...lines: string[]): void;

  attachImage(value: ImageContentData): void;
}

export interface Context {
  connector(): DebugRouterConnector;
}

export interface ImageContentData {
  data: string;
  mimeType: string;
}

export interface ToolDefinition<Schema extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  description: string;
  annotations: {
    title?: string;
    /**
     * If true, the tool does not modify its environment.
     */
    readOnlyHint: boolean;
  };
  schema: Schema;
  handler: (
    request: Request<Schema>,
    response: Response,
    context: Context,
  ) => Promise<void>;
}

export function defineTool<Schema extends z.ZodRawShape>(
  definition: ToolDefinition<Schema>,
): ToolDefinition<Schema> {
  return definition;
}
