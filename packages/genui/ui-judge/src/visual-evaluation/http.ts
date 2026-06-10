// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';

import {
  createVisualEvaluationError,
  toVisualEvaluationErrorResponse,
} from './errors.js';
import { runVisualEvaluation } from './service.js';
import type {
  RunVisualEvaluationOptions,
  VisualEvaluationErrorResponse,
} from './types.js';

const DEFAULT_ENDPOINT_PATH = '/visual-evaluation';
const DEFAULT_MAX_BODY_BYTES = 20 * 1024 * 1024;

export interface VisualEvaluationHttpOptions
  extends RunVisualEvaluationOptions
{
  endpointPath?: string;
  maxBodyBytes?: number;
}

export function createVisualEvaluationServer(
  options: VisualEvaluationHttpOptions = {},
): Server {
  return createServer((req, res) => {
    void handleVisualEvaluationRequest(req, res, options);
  });
}

export async function handleVisualEvaluationRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: VisualEvaluationHttpOptions = {},
): Promise<void> {
  try {
    if (!isExpectedPath(req, options.endpointPath ?? DEFAULT_ENDPOINT_PATH)) {
      writeJson(
        res,
        404,
        toVisualEvaluationErrorResponse(
          createVisualEvaluationError(
            404,
            'NOT_FOUND',
            'Visual evaluation endpoint not found.',
          ),
        ),
      );
      return;
    }

    if (req.method !== 'POST') {
      writeJson(
        res,
        405,
        toVisualEvaluationErrorResponse(
          createVisualEvaluationError(
            405,
            'METHOD_NOT_ALLOWED',
            'Visual evaluation endpoint only supports POST.',
          ),
        ),
      );
      return;
    }

    const bodyText = await readBody(
      req,
      options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES,
    );
    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      writeJson(
        res,
        400,
        toVisualEvaluationErrorResponse(
          createVisualEvaluationError(
            400,
            'INVALID_JSON',
            'Request body cannot be parsed as JSON.',
          ),
        ),
      );
      return;
    }

    const response = await runVisualEvaluation(body as never, options);
    writeJson(res, 200, response);
  } catch (error) {
    const errorResponse = toVisualEvaluationErrorResponse(error);
    writeJson(res, errorResponse.status, errorResponse);
  }
}

function isExpectedPath(req: IncomingMessage, endpointPath: string): boolean {
  const url = new URL(req.url ?? '/', 'http://localhost');
  return url.pathname === endpointPath;
}

async function readBody(
  req: IncomingMessage,
  maxBodyBytes: number,
): Promise<string> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    totalBytes += buffer.length;
    if (totalBytes > maxBodyBytes) {
      throw createVisualEvaluationError(
        413,
        'REQUEST_TOO_LARGE',
        'Request body is too large.',
      );
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString('utf8');
}

function writeJson(
  res: ServerResponse,
  status: number,
  body: VisualEvaluationErrorResponse | unknown,
): void {
  const payload = `${JSON.stringify(body)}\n`;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(payload));
  res.end(payload);
}
