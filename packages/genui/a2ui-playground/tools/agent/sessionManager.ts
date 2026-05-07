// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { randomUUID } from 'node:crypto';

import type {
  AgentActiveRun,
  AgentInterruptResponse,
  AgentSession,
} from './types.js';

const SESSION_TTL_MS = 30 * 60 * 1000;

interface StoredSession extends AgentSession {
  activeRun: AgentActiveRun | null;
}

function toPublicSession(session: StoredSession): AgentSession {
  return {
    sessionId: session.sessionId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    activeRunId: session.activeRunId,
  };
}

export function createSessionManager() {
  const sessions = new Map<string, StoredSession>();

  const cleanupExpiredSessions = () => {
    const now = Date.now();
    for (const [sessionId, session] of sessions) {
      if (now - session.updatedAt > SESSION_TTL_MS) {
        session.activeRun?.stop();
        sessions.delete(sessionId);
      }
    }
  };

  const getStoredSession = (sessionId: string): StoredSession | null => {
    cleanupExpiredSessions();
    return sessions.get(sessionId) ?? null;
  };

  return {
    cleanupExpiredSessions,

    createSession(): AgentSession {
      cleanupExpiredSessions();
      const now = Date.now();
      const session: StoredSession = {
        sessionId: `sess_${randomUUID()}`,
        createdAt: now,
        updatedAt: now,
        activeRunId: null,
        activeRun: null,
      };
      sessions.set(session.sessionId, session);
      return toPublicSession(session);
    },

    getSession(sessionId: string): AgentSession | null {
      const session = getStoredSession(sessionId);
      return session ? toPublicSession(session) : null;
    },

    attachActiveRun(sessionId: string, activeRun: AgentActiveRun): boolean {
      const session = getStoredSession(sessionId);
      if (!session || session.activeRun) {
        return false;
      }

      session.activeRun = activeRun;
      session.activeRunId = activeRun.runId;
      session.updatedAt = Date.now();
      return true;
    },

    clearActiveRun(sessionId: string, runId?: string): void {
      const session = getStoredSession(sessionId);
      if (!session || !session.activeRun) {
        return;
      }

      if (runId && session.activeRun.runId !== runId) {
        return;
      }

      session.activeRun = null;
      session.activeRunId = null;
      session.updatedAt = Date.now();
    },

    interruptSessionRun(sessionId: string): AgentInterruptResponse {
      const session = getStoredSession(sessionId);
      if (!session) {
        return {
          ok: false,
          interrupted: false,
          reason: 'session not found',
        };
      }

      if (!session.activeRun) {
        return {
          ok: true,
          interrupted: false,
          reason: 'no active run',
        };
      }

      const interrupted = session.activeRun.stop();
      if (!interrupted) {
        return {
          ok: true,
          interrupted: false,
          reason: 'run already completed',
        };
      }

      session.activeRun = null;
      session.activeRunId = null;
      session.updatedAt = Date.now();
      return {
        ok: true,
        interrupted: true,
        reason: null,
      };
    },
  };
}
