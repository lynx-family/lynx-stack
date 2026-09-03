// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const TURN_ADMISSION_DEADLINE_MS = 15_000;
export const TURN_ADMISSION_INITIAL_DELAY_MS = 100;
export const TURN_ADMISSION_MAX_DELAY_MS = 1_000;

export interface StructuredApiFailure {
  status: number;
  code: string;
}

export interface AdmissionRetryOptions {
  now?: () => number;
  wait?: (milliseconds: number) => Promise<void>;
  deadlineMs?: number;
}

export async function retryTurnAdmission<T>(
  request: () => Promise<T>,
  options: AdmissionRetryOptions = {},
): Promise<T> {
  const now = options.now ?? (() => performance.now());
  const wait = options.wait
    ?? ((milliseconds) =>
      new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds)));
  const deadlineMs = options.deadlineMs ?? TURN_ADMISSION_DEADLINE_MS;
  const startedAt = now();
  let delay = TURN_ADMISSION_INITIAL_DELAY_MS;
  for (;;) {
    try {
      return await request();
    } catch (error) {
      if (!isActiveTurnConflict(error)) throw error;
      const remaining = deadlineMs - (now() - startedAt);
      if (remaining <= 0) throw error;
      await wait(Math.min(delay, remaining));
      if (now() - startedAt >= deadlineMs) throw error;
      delay = Math.min(delay * 2, TURN_ADMISSION_MAX_DELAY_MS);
    }
  }
}

export async function submitTurnWithSessionRetry<T>(
  createSession: () => Promise<unknown>,
  createTurn: () => Promise<T>,
  options: AdmissionRetryOptions = {},
): Promise<T> {
  return await retryTurnAdmission(async () => {
    await createSession();
    return await createTurn();
  }, options);
}

export function isActiveTurnConflict(
  value: unknown,
): value is StructuredApiFailure {
  return value !== null && typeof value === 'object'
    && 'status' in value && value.status === 409
    && 'code' in value && value.code === 'ACTIVE_TURN_EXISTS';
}
