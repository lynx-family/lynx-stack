#!/usr/bin/env node
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { createServer } from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from '@playwright/test';

import { runPackagedUiConformance } from './playground-ui-conformance.mjs';
import {
  AGENT_IDS,
  buildProbeReport,
  notRun,
  pendingApproval,
  submitWithOptimisticCancellation,
  waitForConversationRender,
  waitForDurableTerminal,
  writeProbeReport,
} from './probe-playground-agents-real-helpers.mjs';

export async function runRealAgentProbe() {
  if (process.env.GENUI_RUN_REAL_AGENT_PROBES !== '1') {
    throw new Error(
      'Set GENUI_RUN_REAL_AGENT_PROBES=1 to run authenticated, capacity-consuming probes.',
    );
  }
  if (process.platform !== 'darwin') {
    throw new Error('GenUI playground currently supports macOS only.');
  }

  const packageRoot = fileURLToPath(new URL('../..', import.meta.url));
  const temporary = fs.mkdtempSync(
    path.join(fs.realpathSync(os.tmpdir()), 'genui-agent-probe-'),
  );
  const packed = path.join(temporary, 'packed');
  const extracted = path.join(temporary, 'extracted');
  const dataRoot = path.join(temporary, 'data');
  fs.mkdirSync(packed);
  fs.mkdirSync(extracted);
  const results = [];
  let descriptors = [];
  let daemon;
  let browser;
  let stdout = '';
  let stderr = '';
  let fatalError;
  let uiConformanceError;
  let uiConformance = {
    transport: 'packaged-fake-protocol-daemon-http-sse-control-ui-playwright',
    cancellation: false,
    allowOnce: false,
    deny: false,
    uniqueTerminal: false,
    noLateArtifact: false,
    noOrphanProcesses: false,
    admissionRetry: false,
    awaitingApprovalCancellation: false,
    approvalActor: 'playwright-user-click',
  };
  let report;

  try {
    try {
      uiConformance = await runPackagedUiConformance(packageRoot);
    } catch (error) {
      uiConformanceError = error instanceof Error
        ? error.message
        : String(error);
    }
    const pack = JSON.parse(execFileSync(
      'pnpm',
      ['pack', '--pack-destination', packed, '--json'],
      { cwd: packageRoot, encoding: 'utf8' },
    ));
    execFileSync('tar', ['-xzf', pack.filename, '-C', extracted]);
    const cli = path.join(extracted, 'package', 'cli', 'bin', 'cli.js');
    const port = await availablePort();
    const daemonEnvironment = {
      ...process.env,
      GENUI_REQUIRE_ISOLATED_PREVIEW: '1',
      NO_PROXY: '127.0.0.1,localhost',
    };
    daemon = spawn(
      process.execPath,
      [
        cli,
        'playground',
        '--no-open',
        '--port',
        String(port),
        '--data-dir',
        dataRoot,
      ],
      {
        cwd: extracted,
        env: daemonEnvironment,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    daemon.stdout.setEncoding('utf8');
    daemon.stderr.setEncoding('utf8');
    daemon.stdout.on('data', (chunk) => stdout += chunk);
    daemon.stderr.on('data', (chunk) => stderr += chunk);
    await waitFor(() => stdout.includes('#bootstrap='), 20_000);

    const second = await runSecondBootstrap(
      cli,
      port,
      dataRoot,
      extracted,
      daemonEnvironment,
    );
    const bootstrapUrl = second.trim().split(/\s+/u).find((part) =>
      part.startsWith('http://127.0.0.1:') && part.includes('#bootstrap=')
    );
    assert(bootstrapUrl, 'second CLI did not receive a bootstrap URL');

    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    browser = await chromium.launch({
      headless: true,
      args: ['--no-proxy-server'],
      ...(fs.existsSync(executablePath) ? { executablePath } : {}),
    });
    const page = await browser.newPage();
    if (process.env.GENUI_DEBUG_REAL_AGENT_PROBE === '1') {
      page.on('console', (message) => {
        if (message.text().startsWith('[probe-trace]')) {
          console.error(message.text());
        }
      });
    }
    await page.goto(bootstrapUrl);
    await page.waitForSelector('#new');
    const agentsResponse = await page.evaluate(async () =>
      await fetch('/api/agents', { credentials: 'same-origin' }).then(
        (response) => response.json(),
      )
    );
    descriptors = agentsResponse.agents;
    assert.deepEqual(
      descriptors.map((descriptor) => descriptor.id),
      AGENT_IDS,
      '/api/agents must expose exactly the supported Agent set',
    );
    const preflightFailures = descriptors.filter((descriptor) =>
      !descriptor.available
      || descriptor.authentication !== 'authenticated'
    );
    if (uiConformanceError) {
      preflightFailures.push({
        id: 'ui-conformance',
        available: false,
        authentication: 'not-applicable',
      });
    }
    if (preflightFailures.length > 0) {
      for (const descriptor of descriptors) {
        results.push(notRun(descriptor, preflightFailures));
      }
    } else {
      const selectedIds = new Set(
        (process.env.GENUI_AGENT_PROBE_IDS ?? '').split(',').filter(Boolean),
      );
      const targets = selectedIds.size > 0
        ? descriptors.filter((descriptor) => selectedIds.has(descriptor.id))
        : descriptors;
      for (const descriptor of targets) {
        results.push(
          await probeAgent(
            page,
            descriptor,
            dataRoot,
            temporary,
            daemon.pid,
          ),
        );
      }
    }
  } catch (error) {
    fatalError = errorMessage(error);
  } finally {
    try {
      await browser?.close();
    } catch (error) {
      fatalError = appendError(fatalError, 'browser cleanup', error);
    }
    try {
      if (daemon && daemon.exitCode === null) {
        daemon.kill('SIGINT');
        await Promise.race([
          new Promise((resolve) => daemon.once('close', resolve)),
          new Promise((resolve) => setTimeout(resolve, 10_000)),
        ]);
        if (daemon.exitCode === null) daemon.kill('SIGKILL');
      }
    } catch (error) {
      fatalError = appendError(fatalError, 'daemon cleanup', error);
    }
    report = buildProbeReport({
      descriptors,
      results,
      uiConformance,
      uiConformanceError,
      fatalError,
    });
    writeProbeReport(report);
    if (!report.ok) process.exitCode = 1;
    if (fatalError && stderr) console.error(stderr.slice(0, 4_096));
    fs.rmSync(temporary, { recursive: true, force: true });
  }
  return report;
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await runRealAgentProbe();
}

async function probeAgent(
  page,
  descriptor,
  dataRoot,
  temporaryRoot,
  daemonPid,
) {
  const result = {
    id: descriptor.id,
    generation: false,
    iteration: false,
    cancellation: false,
    uniqueTerminal: false,
    lateArtifactCount: null,
    approval: descriptor.capabilities.approvals
      ? { allowOnce: pendingApproval(), deny: pendingApproval() }
      : {
        outcome: 'unsupported',
        reason: 'agent-does-not-expose-approval-capability',
      },
    noOrphanProcesses: false,
    status: 'RUN',
    ok: false,
  };
  try {
    const conversationId = await createProbeConversation(page);
    await page.selectOption('#localAgentAgent', descriptor.id);
    assert.deepEqual(
      descendantProcessIds(daemonPid),
      [],
      'packaged Daemon had descendants before the Agent probe',
    );
    console.error('[probe] ' + descriptor.id + ': generate');

    const generated = await submitAndWait(
      page,
      dataRoot,
      conversationId,
      'Return only a minimal valid Lynx XML document with one main-thread script. Do not use tools.',
      'completed',
    );
    result.generation = Boolean(generated.revision);
    await waitForNoDescendants(daemonPid);
    result.uniqueTerminal = hasUniqueTerminal(
      dataRoot,
      conversationId,
      generated.id,
    );
    await refreshConversation(page, conversationId);

    console.error('[probe] ' + descriptor.id + ': iterate');
    const iterated = await submitAndWait(
      page,
      dataRoot,
      conversationId,
      'Iterate the latest artifact by adding one harmless comment. Return only the complete valid Lynx XML.',
      'completed',
    );
    result.iteration = Number(iterated.revision) > Number(generated.revision);
    await waitForNoDescendants(daemonPid);
    result.uniqueTerminal = result.uniqueTerminal
      && hasUniqueTerminal(dataRoot, conversationId, iterated.id);
    await refreshConversation(page, conversationId);

    console.error('[probe] ' + descriptor.id + ': cancel');
    const cancelled = await submitAndCancel(page, dataRoot, conversationId);
    await waitForNoDescendants(daemonPid);
    result.cancellation = cancelled.status === 'cancelled';
    result.uniqueTerminal = result.uniqueTerminal
      && hasUniqueTerminal(dataRoot, conversationId, cancelled.id);
    result.lateArtifactCount = lateArtifactCount(
      dataRoot,
      conversationId,
      cancelled.id,
    );
    assert.equal(
      result.lateArtifactCount,
      0,
      'cancelled turn published a late artifact',
    );
    await refreshConversation(page, conversationId);

    if (descriptor.capabilities.approvals) {
      console.error('[probe] ' + descriptor.id + ': allow_once');
      const allowed = await submitAndApprove(
        page,
        dataRoot,
        conversationId,
        'allow_once',
        temporaryRoot,
      );
      await waitForNoDescendants(daemonPid);
      result.approval.allowOnce = approvalEvidence(
        dataRoot,
        conversationId,
        allowed.turn,
        'allow_once',
        allowed,
      );
      await refreshConversation(page, conversationId);
      console.error('[probe] ' + descriptor.id + ': deny');
      const denied = await submitAndApprove(
        page,
        dataRoot,
        conversationId,
        'deny',
        temporaryRoot,
      );
      await waitForNoDescendants(daemonPid);
      result.approval.deny = approvalEvidence(
        dataRoot,
        conversationId,
        denied.turn,
        'deny',
        denied,
      );
      await refreshConversation(page, conversationId);
      result.uniqueTerminal = result.uniqueTerminal
        && result.approval.allowOnce.uniqueTerminal
        && result.approval.deny.uniqueTerminal;
    }
    await waitForNoDescendants(daemonPid);
    result.noOrphanProcesses = true;
    const approvalsComplete = descriptor.capabilities.approvals
      ? validRealApproval(result.approval.allowOnce)
        && validRealApproval(result.approval.deny)
      : result.approval.outcome === 'unsupported'
        && result.approval.reason
          === 'agent-does-not-expose-approval-capability';
    result.ok = result.generation && result.iteration && result.cancellation
      && result.uniqueTerminal && result.lateArtifactCount === 0
      && result.noOrphanProcesses
      && approvalsComplete;
    result.status = result.ok ? 'PASS' : 'FAIL';
  } catch (error) {
    result.status = 'FAIL';
    result.error = error instanceof Error ? error.message : String(error);
    await cancelActiveTurn(page).catch(() => undefined);
    await waitFor(
      () => descendantProcessIds(daemonPid).length === 0,
      10_000,
    ).catch(() => undefined);
    result.noOrphanProcesses = descendantProcessIds(daemonPid).length === 0;
  }
  return result;
}

async function submitAndWait(
  page,
  dataRoot,
  conversationId,
  prompt,
  expectedStatus,
) {
  await startTurn(page, dataRoot, conversationId, prompt);
  const turn = await waitForTurn(
    dataRoot,
    conversationId,
    (candidate) => candidate.prompt === prompt && isTerminal(candidate.status),
  );
  assert.equal(
    turn.status,
    expectedStatus,
    turn.error ?? `Expected turn status ${expectedStatus}`,
  );
  await waitForDurableTerminal(
    () => hasUniqueTerminal(dataRoot, conversationId, turn.id),
  );
  return turn;
}

async function submitAndCancel(page, dataRoot, conversationId) {
  const prompt = 'Return only a minimal valid Lynx XML document. Do not use '
    + 'tools. This turn will be cancelled immediately by the Playground UI.';
  await waitForSubmit(page);
  await traceCancellationDom(page, 'before-submit');
  const traceRequest = (request) => {
    const pathname = new URL(request.url()).pathname;
    if (
      request.method() === 'PUT' && (pathname.includes('/sessions/')
        || pathname.includes('/turns/'))
    ) {
      probeTrace('request', { method: request.method(), pathname });
    }
  };
  const traceResponse = (response) => {
    const pathname = new URL(response.url()).pathname;
    if (
      response.request().method() === 'PUT' && (pathname.includes('/sessions/')
        || pathname.includes('/turns/'))
    ) {
      probeTrace('response', {
        method: response.request().method(),
        pathname,
        status: response.status(),
      });
    }
  };
  if (process.env.GENUI_DEBUG_REAL_AGENT_PROBE === '1') {
    page.on('request', traceRequest);
    page.on('response', traceResponse);
  }
  let cancellation;
  try {
    cancellation = await submitWithOptimisticCancellation(
      page,
      conversationId,
      prompt,
    );
  } finally {
    if (process.env.GENUI_DEBUG_REAL_AGENT_PROBE === '1') {
      page.off('request', traceRequest);
      page.off('response', traceResponse);
      await traceCancellationDom(page, 'after-submit').catch(() => undefined);
    }
  }
  const { turnId, cancellationUrl, response } = cancellation;
  assert.equal(new URL(response.url()).pathname, cancellationUrl);
  assert.equal(
    new URL(response.url()).pathname.endsWith(
      '/turns/' + turnId + '/cancellation',
    ),
    true,
    'control UI cancelled a different turn',
  );
  assert.equal(response.ok(), true, 'control UI cancellation API failed');
  const responseBody = await response.json();
  assert.equal(
    responseBody?.turn?.id,
    turnId,
    'control UI cancellation response identified a different turn',
  );
  assert.equal(
    responseBody?.turn?.status,
    'cancelled',
    'control UI cancellation response was not terminal cancelled',
  );
  const turn = await waitForTurn(
    dataRoot,
    conversationId,
    (candidate) => candidate.prompt === prompt && isTerminal(candidate.status),
  );
  assert.equal(
    turn.status,
    'cancelled',
    'persisted cancellation was not cancelled',
  );
  await waitFor(
    () => hasUniqueTerminal(dataRoot, conversationId, turnId),
    30_000,
  );
  return turn;
}

async function submitAndApprove(
  page,
  dataRoot,
  conversationId,
  decision,
  temporaryRoot,
) {
  const marker = path.join(temporaryRoot, 'approval-' + decision + '.txt');
  const prompt = 'Request permission to run a shell command that writes the '
    + 'word approved to this exact file outside the workspace: ' + marker
    + '. Wait for the browser decision, then return a minimal valid Lynx XML '
    + 'document (' + decision + ').';
  await startTurn(page, dataRoot, conversationId, prompt);
  const button = page.locator(
    '.localAgentApproval button[data-decision="' + decision + '"]',
  );
  const next = await Promise.race([
    button.waitFor({ state: 'visible', timeout: 120_000 }).then(() => ({
      observed: true,
    })),
    waitForTurn(
      dataRoot,
      conversationId,
      (candidate) =>
        candidate.prompt === prompt && isTerminal(candidate.status),
    ).then((turn) => ({ observed: false, turn })),
  ]);
  if (!next.observed) {
    assert.equal(
      next.turn.status,
      'completed',
      `${decision} no-request turn did not complete`,
    );
    await waitForDurableTerminal(
      () => hasUniqueTerminal(dataRoot, conversationId, next.turn.id),
    );
    return {
      ...next,
      apiSucceeded: false,
    };
  }
  const requestId = await button.evaluate((element) =>
    element.closest('.localAgentApproval')?.getAttribute('data-approval-id')
      ?? ''
  );
  assert(requestId, decision + ' approval did not expose its request ID');
  const approvalResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith(
        '/approvals/' + requestId,
      ),
    { timeout: 30_000 },
  );
  await clickUiControl(
    page,
    '.localAgentApproval button[data-decision="' + decision + '"]',
    15_000,
  );
  const response = await approvalResponse;
  assert.equal(response.ok(), true, decision + ' approval API failed');
  const responseBody = await response.json();
  assert.equal(
    responseBody?.resolved,
    true,
    decision + ' approval API did not confirm resolution',
  );
  assert.equal(responseBody?.requestId, requestId);
  assert.equal(responseBody?.decision, decision);
  const turn = await waitForTurn(
    dataRoot,
    conversationId,
    (candidate) => candidate.prompt === prompt && isTerminal(candidate.status),
  );
  await waitForDurableTerminal(
    () => hasUniqueTerminal(dataRoot, conversationId, turn.id),
  );
  return { observed: true, apiSucceeded: true, turn };
}

async function waitForSubmit(page) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const prompt = page.locator('#prompt');
    const cancel = page.locator('#global-cancel');
    if (
      await prompt.count() > 0
      && await prompt.isEnabled()
      && await cancel.getAttribute('data-active-turn-id') === ''
    ) return;
    await page.waitForTimeout(100);
  }
  throw new Error('Control UI did not release the global turn slot');
}

async function waitForSubmitButton(page) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const button = page.locator('#prompt-form button[type="submit"]');
    if (await button.count() > 0 && await button.isEnabled()) return button;
    await page.waitForTimeout(50);
  }
  throw new Error('Control UI did not enable prompt submission');
}

async function startTurn(page, dataRoot, conversationId, prompt) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await waitForSubmit(page);
    await page.fill('#prompt', prompt);
    const button = await waitForSubmitButton(page);
    await button.click();
    try {
      return await waitForTurn(
        dataRoot,
        conversationId,
        (candidate) => candidate.prompt === prompt,
        30_000,
      );
    } catch {
      await refreshConversation(page, conversationId);
      await page.waitForTimeout(1_000);
    }
  }
  throw new Error('Control UI did not persist the submitted turn');
}

async function cancelActiveTurn(page) {
  await clickUiControl(page, '#global-cancel', 1_000).catch(() => undefined);
}

async function clickUiControl(page, selector, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const control = page.locator(selector);
    if (await control.count() > 0) {
      try {
        await control.click({ timeout: 1_000 });
        return;
      } catch {
        // SSE rendering can replace the current control between lookup/click.
      }
    }
    await page.waitForTimeout(25);
  }
  throw new Error('Control UI did not expose ' + selector);
}

async function createProbeConversation(page) {
  const creationResponse = page.waitForResponse((response) => {
    const pathname = new URL(response.url()).pathname;
    return response.request().method() === 'PUT'
      && /^\/api\/conversations\/[^/]+$/u.test(pathname);
  });
  await page.click('#new');
  const response = await creationResponse;
  assert.equal(response.ok(), true, 'conversation creation API failed');
  const body = await response.json();
  const conversationId = body?.conversation?.id;
  assert.equal(typeof conversationId, 'string');
  /* eslint-disable no-undef -- this closure runs in Chromium. */
  await page.waitForFunction((id) => {
    const activeConversation = document.querySelector(
      '.conversationListItem-active',
    )?.getAttribute('data-id');
    return activeConversation === id
      && Boolean(document.querySelector('#prompt-form'));
  }, conversationId);
  /* eslint-enable no-undef */
  return conversationId;
}

async function refreshConversation(page, conversationId) {
  probeTrace('refresh.begin', { conversationId });
  const previousForm = await page.$('#prompt-form');
  const selectionPath = '/api/conversations/' + conversationId;
  const selectionResponse = page.waitForResponse((response) =>
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === selectionPath
  );
  await page.reload();
  const selector = '.conversationListItem[data-id="' + conversationId + '"]';
  await page.waitForSelector(selector);
  const before = await traceCancellationDom(page, 'refresh.before-click');
  const activeId = await page.locator('.conversationListItem-active')
    .getAttribute('data-id');
  if (activeId !== conversationId) await page.click(selector);
  const response = await selectionResponse;
  assert.equal(response.ok(), true, 'conversation refresh API failed');
  probeTrace('refresh.selection-response', {
    conversationId,
    status: response.status(),
  });
  await waitForConversationRender(page, previousForm, conversationId);
  const after = await traceCancellationDom(page, 'refresh.after-form-wait');
  probeTrace('refresh.wait-result', {
    conversationId,
    selectionResponseSeen: true,
    formReplaced: before?.formToken !== after?.formToken,
  });
}

async function traceCancellationDom(page, label) {
  if (process.env.GENUI_DEBUG_REAL_AGENT_PROBE !== '1') return undefined;
  /* eslint-disable no-undef, n/no-unsupported-features/node-builtins -- this closure runs in Chromium. */
  const state = await page.evaluate((traceLabel) => {
    const form = document.querySelector('#prompt-form');
    const prompt = document.querySelector('#prompt');
    const agent = document.querySelector('#localAgentAgent');
    const cancel = document.querySelector('#global-cancel');
    const activeConversation = document.querySelector(
      '.conversationListItem-active',
    );
    const warning = document.querySelector('#warnings');
    const formToken = form
      ? (form.__genuiProbeToken ??= crypto.randomUUID())
      : null;
    return {
      label: traceLabel,
      formToken,
      formConnected: form?.isConnected ?? false,
      formValid: form instanceof HTMLFormElement ? form.checkValidity() : null,
      promptValue: prompt instanceof HTMLTextAreaElement ? prompt.value : null,
      agentValue: agent instanceof HTMLSelectElement ? agent.value : null,
      activeConversationId: activeConversation?.getAttribute('data-id') ?? null,
      activeTurnId: cancel?.getAttribute('data-active-turn-id') ?? null,
      warningText: warning?.textContent ?? '',
    };
  }, label);
  /* eslint-enable no-undef, n/no-unsupported-features/node-builtins */
  probeTrace('dom', state);
  return state;
}

function probeTrace(event, value) {
  if (process.env.GENUI_DEBUG_REAL_AGENT_PROBE === '1') {
    console.error(
      `[probe-trace] ${Date.now()} ${event} ${JSON.stringify(value)}`,
    );
  }
}

async function waitForTurn(
  dataRoot,
  conversationId,
  predicate,
  timeoutMs = 120_000,
) {
  let found;
  await waitFor(() => {
    try {
      const root = path.join(
        dataRoot,
        'sessions',
        conversationId,
        'turns',
      );
      found = fs.readdirSync(root).map((entry) =>
        JSON.parse(fs.readFileSync(path.join(root, entry), 'utf8'))
      ).find((candidate) => predicate(candidate));
      return Boolean(found);
    } catch {
      return false;
    }
  }, timeoutMs);
  return found;
}

function hasUniqueTerminal(dataRoot, conversationId, turnId) {
  const source = fs.readFileSync(
    path.join(dataRoot, 'sessions', conversationId, 'events.jsonl'),
    'utf8',
  );
  const terminal = new Set([
    'turn.completed',
    'turn.failed',
    'turn.cancelled',
    'turn.interrupted',
  ]);
  return source.trim().split('\n').map((line) => JSON.parse(line))
    .filter((event) => event.turnId === turnId && terminal.has(event.type))
    .length === 1;
}

function hasApprovalLifecycle(
  dataRoot,
  conversationId,
  turnId,
  decision,
) {
  const events = readEvents(dataRoot, conversationId);
  const requests = events.filter((event) =>
    event.turnId === turnId && event.type === 'approval.requested'
  );
  const resolutions = events.filter((event) =>
    event.turnId === turnId && event.type === 'approval.resolved'
  );
  return requests.length === 1 && resolutions.length === 1
    && requests[0]?.payload?.requestId === resolutions[0]?.payload?.requestId
    && resolutions[0]?.payload?.decision === decision;
}

function approvalEvidence(
  dataRoot,
  conversationId,
  turn,
  decision,
  observation,
) {
  const events = readEvents(dataRoot, conversationId).filter((event) =>
    event.turnId === turn.id
  );
  const requests = events.filter((event) =>
    event.type === 'approval.requested'
  );
  const resolutions = events.filter((event) =>
    event.type === 'approval.resolved'
  );
  const requestCount = requests.length;
  const resolutionCount = resolutions.length;
  const pendingApprovalCount = readSnapshot(dataRoot, conversationId)
    .pendingApprovals.filter((approval) => approval.turnId === turn.id).length;
  const uniqueTerminal = hasUniqueTerminal(dataRoot, conversationId, turn.id);
  if (!observation.observed) {
    assert.equal(requestCount, 0);
    assert.equal(resolutionCount, 0);
    assert.equal(uniqueTerminal, true);
    assert.equal(pendingApprovalCount, 0);
    return {
      outcome: 'not-requested-under-inherited-config',
      requestCount,
      resolutionCount,
      uniqueTerminal,
      pendingApprovalCount,
    };
  }
  assert.equal(
    hasApprovalLifecycle(dataRoot, conversationId, turn.id, decision),
    true,
  );
  return {
    outcome: 'observed-and-resolved',
    requestCount,
    resolutionCount,
    actor: 'playwright-user-click',
    apiSucceeded: observation.apiSucceeded === true,
    requestId: requests[0]?.payload?.requestId,
    resolutionRequestId: resolutions[0]?.payload?.requestId,
    decision,
    uniqueTerminal,
    pendingApprovalCount,
  };
}

function validRealApproval(approval) {
  if (approval.outcome === 'observed-and-resolved') {
    return approval.requestCount === 1 && approval.resolutionCount === 1
      && approval.actor === 'playwright-user-click'
      && approval.apiSucceeded === true && approval.uniqueTerminal === true
      && approval.pendingApprovalCount === 0;
  }
  return approval.outcome === 'not-requested-under-inherited-config'
    && approval.requestCount === 0 && approval.resolutionCount === 0
    && approval.uniqueTerminal === true && approval.pendingApprovalCount === 0;
}

function readSnapshot(dataRoot, conversationId) {
  const conversation = JSON.parse(fs.readFileSync(
    path.join(dataRoot, 'sessions', conversationId, 'session.json'),
    'utf8',
  ));
  const activeStatuses = new Set([
    'accepted',
    'starting',
    'running',
    'awaiting_approval',
    'cancelling',
  ]);
  const activeTurns = new Set(
    fs.readdirSync(
      path.join(dataRoot, 'sessions', conversationId, 'turns'),
    ).map((entry) =>
      JSON.parse(fs.readFileSync(
        path.join(dataRoot, 'sessions', conversationId, 'turns', entry),
        'utf8',
      ))
    ).filter((turn) => activeStatuses.has(turn.status)).map((turn) => turn.id),
  );
  const pending = new Map();
  for (const event of readEvents(dataRoot, conversationId)) {
    if (event.type === 'approval.requested') {
      pending.set(event.payload.requestId, event);
    } else if (event.type === 'approval.resolved') {
      pending.delete(event.payload.requestId);
    }
  }
  return {
    conversation,
    pendingApprovals: [...pending.values()].filter((event) =>
      activeTurns.has(event.turnId)
    ),
  };
}

function readEvents(dataRoot, conversationId) {
  const source = fs.readFileSync(
    path.join(dataRoot, 'sessions', conversationId, 'events.jsonl'),
    'utf8',
  );
  return source.trim().split('\n').filter(Boolean).map((line) =>
    JSON.parse(line)
  );
}

function lateArtifactCount(dataRoot, conversationId, turnId) {
  return readEvents(dataRoot, conversationId).filter((event) =>
    event.turnId === turnId && event.type === 'artifact.ready'
  ).length;
}

function errorMessage(error) {
  return error instanceof Error ? error.stack ?? error.message : String(error);
}

function appendError(current, phase, error) {
  const message = `${phase}: ${errorMessage(error)}`;
  return current ? `${current}\n${message}` : message;
}

function descendantProcessIds(daemonPid) {
  const output = execFileSync('ps', ['-axo', 'pid=,ppid=,command='], {
    encoding: 'utf8',
  });
  const processes = output.split('\n').flatMap((line) => {
    const fields = line.trim().split(' ');
    const pid = fields.shift();
    while (fields[0] === '') fields.shift();
    const ppid = fields.shift();
    while (fields[0] === '') fields.shift();
    return pid && ppid && fields.length > 0
      ? [{ pid: Number(pid), ppid: Number(ppid), command: fields.join(' ') }]
      : [];
  });
  const descendants = new Set([daemonPid]);
  for (let pass = processes.length; pass > 0; pass -= 1) {
    for (const process of processes) {
      if (descendants.has(process.ppid)) descendants.add(process.pid);
    }
  }
  descendants.delete(daemonPid);
  return [...descendants];
}

async function waitForNoDescendants(daemonPid) {
  await waitFor(
    () => descendantProcessIds(daemonPid).length === 0,
    30_000,
  );
}

function isTerminal(status) {
  return ['completed', 'failed', 'cancelled', 'interrupted'].includes(status);
}

async function runSecondBootstrap(cli, port, dataRoot, cwd, env) {
  const child = spawn(
    process.execPath,
    [
      cli,
      'playground',
      '--no-open',
      '--port',
      String(port),
      '--data-dir',
      dataRoot,
    ],
    { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let output = '';
  let errors = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => output += chunk);
  child.stderr.on('data', (chunk) => errors += chunk);
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error('second CLI exited ' + code + ': ' + errors)));
  });
  return output;
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert(address && typeof address === 'object');
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out after ' + timeoutMs + ' ms');
}
