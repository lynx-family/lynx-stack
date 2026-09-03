// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as fs from 'node:fs';

export const AGENT_IDS = ['codex', 'claude', 'cursor', 'trae'];

export function buildProbeReport({
  descriptors,
  results,
  uiConformance,
  uiConformanceError,
  fatalError,
}) {
  const availableDescriptors = Array.isArray(descriptors) ? descriptors : [];
  const availableResults = Array.isArray(results) ? results : [];
  const orderedResults = AGENT_IDS.map((id) => {
    const existing = availableResults.find((result) => result.id === id);
    if (existing) return existing;
    const descriptor = availableDescriptors.find((candidate) =>
      candidate.id === id
    ) ?? { id };
    return notRun(descriptor, [{
      id: fatalError ? 'probe' : 'selection',
      available: false,
      authentication: 'unknown',
    }], fatalError);
  });
  const ok = !fatalError
    && orderedResults.every((result) => result.ok)
    && uiConformance.transport
      === 'packaged-fake-protocol-daemon-http-sse-control-ui-playwright'
    && uiConformance.approvalActor === 'playwright-user-click'
    && [
      uiConformance.cancellation,
      uiConformance.allowOnce,
      uiConformance.deny,
      uiConformance.uniqueTerminal,
      uiConformance.noLateArtifact,
      uiConformance.noOrphanProcesses,
      uiConformance.admissionRetry,
      uiConformance.awaitingApprovalCancellation,
    ].every((value) => value === true);
  const observedApprovals = orderedResults.reduce(
    (total, result) => total + approvalOpportunityCount(result),
    0,
  );
  return {
    agentIds: AGENT_IDS,
    generatedAt: new Date().toISOString(),
    platform: process.platform,
    transport: 'tarball-daemon-http-sse-control-ui-playwright',
    approvalActor: 'playwright-user-click',
    uiConformance,
    ...(uiConformanceError ? { uiConformanceError } : {}),
    ...(fatalError ? { error: fatalError } : {}),
    approvalCoverage: observedApprovals === 6
      ? 'full'
      : (observedApprovals === 0 ? 'none' : 'partial'),
    ok,
    verdict: ok ? 'PASS' : 'FAIL',
    results: orderedResults,
  };
}

export function notRun(descriptor, failures, failureMessage) {
  const approvalCapable = ['codex', 'cursor', 'trae'].includes(descriptor.id);
  return {
    id: descriptor.id,
    generation: false,
    iteration: false,
    cancellation: false,
    uniqueTerminal: false,
    lateArtifactCount: null,
    approval: approvalCapable
      ? { allowOnce: pendingApproval(), deny: pendingApproval() }
      : {
        outcome: 'unsupported',
        reason: 'agent-does-not-expose-approval-capability',
      },
    noOrphanProcesses: false,
    status: 'NOT RUN',
    ok: false,
    error: failureMessage ?? (
      'four-agent preflight failed: '
      + failures.map((failure) =>
        failure.id + ':' + (failure.available ? 'available' : 'unavailable')
        + '/' + failure.authentication
      ).join(', ')
    ),
  };
}

export function pendingApproval() {
  return {
    outcome: 'not-run',
    requestCount: 0,
    resolutionCount: 0,
    uniqueTerminal: false,
    pendingApprovalCount: 0,
  };
}

export function writeProbeReport(report) {
  const serialized = JSON.stringify(report, null, 2) + '\n';
  const reportPath = process.env.GENUI_AGENT_PROBE_REPORT;
  if (reportPath) {
    fs.writeFileSync(reportPath, serialized, { mode: 0o600 });
  }
  console.info(serialized.trimEnd());
}

export function waitForExactResponse(
  page,
  matchesPathname,
  timeoutMs = 30_000,
) {
  let settled = false;
  let resolvePromise;
  let rejectPromise;
  let timer;
  const cleanup = () => {
    page.off('response', onResponse);
    clearTimeout(timer);
  };
  const onResponse = (response) => {
    if (
      response.request().method() !== 'PUT'
      || !matchesPathname(new URL(response.url()).pathname)
    ) return;
    settled = true;
    cleanup();
    resolvePromise(response);
  };
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  page.on('response', onResponse);
  timer = setTimeout(() => {
    settled = true;
    cleanup();
    rejectPromise(new Error('Timed out waiting for cancellation response'));
  }, timeoutMs);
  return {
    promise,
    cancel() {
      if (settled) return;
      settled = true;
      cleanup();
      rejectPromise(new Error('Cancelled response wait for PUT cancellation'));
    },
  };
}

export async function waitForDurableTerminal(
  hasUniqueTerminal,
  timeoutMs = 30_000,
) {
  const deadline = Date.now() + timeoutMs;
  do {
    if (hasUniqueTerminal()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  } while (Date.now() < deadline);
  throw new Error('Timed out waiting for the durable terminal event');
}

export async function waitForConversationRender(
  page,
  _previousForm,
  conversationId,
) {
  /* eslint-disable no-undef -- these closures run in the browser realm. */
  await page.waitForFunction((id) => {
    const activeConversation = document.querySelector(
      '.conversationListItem-active',
    )
      ?.getAttribute('data-id');
    const form = document.querySelector('#prompt-form');
    const prompt = form?.querySelector('#prompt');
    return activeConversation === id
      && Boolean(form?.isConnected)
      && prompt instanceof HTMLTextAreaElement
      && !prompt.disabled;
  }, conversationId);
  /* eslint-enable no-undef */
}

export async function submitWithOptimisticCancellation(
  page,
  conversationId,
  prompt,
) {
  let matchedTurnId;
  const cancellationPrefix = `/api/conversations/${conversationId}/turns/`;
  const cancellationResponse = waitForExactResponse(page, (pathname) => {
    if (
      !pathname.startsWith(cancellationPrefix)
      || !pathname.endsWith('/cancellation')
    ) return false;
    const turnId = pathname.slice(
      cancellationPrefix.length,
      -'/cancellation'.length,
    );
    if (!turnId || turnId.includes('/')) return false;
    matchedTurnId = turnId;
    return true;
  });
  /* eslint-disable no-undef -- this closure runs in the browser realm */
  let binding;
  try {
    await page.fill('#prompt', prompt);
    binding = await page.locator('#prompt-form button[type="submit"]')
      .evaluate((element) => {
        return new Promise((resolve, reject) => {
          const form = element.closest('form');
          if (!form) {
            reject(new Error('Current prompt form is missing'));
            return;
          }
          const control = document.querySelector('#global-cancel');
          if (!control) {
            reject(new Error('Stable cancel control is missing'));
            return;
          }
          const existing = control.getAttribute('data-active-turn-id');
          if (existing) {
            const conversationId = control.getAttribute(
              'data-active-conversation-id',
            );
            control.click();
            resolve({ turnId: existing, conversationId });
            return;
          }
          let timeout;
          let resolved = false;
          const resolveBinding = () => {
            if (resolved) return true;
            const observed = control.getAttribute('data-active-turn-id');
            if (!observed) return false;
            resolved = true;
            clearTimeout(timeout);
            observe.disconnect();
            form.removeEventListener('submit', resolveBinding);
            const conversationId = control.getAttribute(
              'data-active-conversation-id',
            );
            control.click();
            resolve({ turnId: observed, conversationId });
            return true;
          };
          const observe = new MutationObserver(resolveBinding);
          timeout = setTimeout(() => {
            observe.disconnect();
            form.removeEventListener('submit', resolveBinding);
            reject(new Error('Optimistic turn ID was not exposed'));
          }, 5_000);
          observe.observe(control, { attributes: true });
          form.addEventListener('submit', resolveBinding, { once: true });
          const submitWhenEnabled = () => {
            if (resolved) return;
            if (!element.disabled) {
              form.requestSubmit(element);
              resolveBinding();
              return;
            }
            setTimeout(submitWhenEnabled, 10);
          };
          submitWhenEnabled();
        });
      });
  } catch (error) {
    cancellationResponse.cancel();
    await cancellationResponse.promise.catch(() => undefined);
    throw error;
  }
  /* eslint-enable no-undef */
  try {
    const { turnId, conversationId: boundConversationId } = binding;
    if (!turnId) {
      throw new Error(
        'Stable cancel control did not expose optimistic turn ID',
      );
    }
    if (boundConversationId !== conversationId) {
      throw new Error('Stable cancel control bound a different conversation');
    }
    const cancellationUrl = '/api/conversations/' + conversationId + '/turns/'
      + turnId + '/cancellation';
    const response = await cancellationResponse.promise;
    if (matchedTurnId !== turnId) {
      throw new Error('Cancellation response was for a different turn');
    }
    return { turnId, cancellationUrl, response };
  } catch (error) {
    cancellationResponse.cancel();
    await cancellationResponse.promise.catch(() => undefined);
    throw error;
  }
}

function approvalOpportunityCount(result) {
  if (!result.approval?.allowOnce) return 0;
  return [result.approval.allowOnce, result.approval.deny].filter(
    (approval) => approval.outcome === 'observed-and-resolved',
  ).length;
}
