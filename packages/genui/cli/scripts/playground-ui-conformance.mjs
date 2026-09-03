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

const APPROVAL_IDS = ['codex', 'cursor', 'trae'];
const ALL_IDS = ['codex', 'claude', 'cursor', 'trae'];
const ARTIFACT =
  '<!doctype lynx><lynx engine-version="4.2"><script thread="main">const page = __CreatePage("0", 0);</script></lynx>';

export async function runPackagedUiConformance(packageRoot) {
  const temporary = fs.mkdtempSync(
    path.join(fs.realpathSync(os.tmpdir()), 'genui-ui-conformance-'),
  );
  const packed = path.join(temporary, 'packed');
  const extracted = path.join(temporary, 'extracted');
  const dataRoot = path.join(temporary, 'data');
  const bin = path.join(temporary, 'bin');
  const protocolLog = path.join(temporary, 'protocol.log');
  fs.mkdirSync(packed);
  fs.mkdirSync(extracted);
  fs.mkdirSync(bin);
  installFakeAgents(bin);
  let daemon;
  let browser;
  if (process.env.GENUI_DEBUG_UI_CONFORMANCE === '1') {
    console.error(`[ui-conformance] evidence: ${temporary}`);
  }
  try {
    const pack = JSON.parse(execFileSync(
      'pnpm',
      ['pack', '--pack-destination', packed, '--json'],
      { cwd: packageRoot, encoding: 'utf8' },
    ));
    execFileSync('tar', ['-xzf', pack.filename, '-C', extracted]);
    const cli = path.join(extracted, 'package', 'cli', 'bin', 'cli.js');
    const port = await availablePort();
    const environment = {
      ...process.env,
      PATH: bin + path.delimiter + process.env.PATH,
      GENUI_REQUIRE_ISOLATED_PREVIEW: '1',
      GENUI_FAKE_PROTOCOL_LOG: protocolLog,
      NO_PROXY: '127.0.0.1,localhost',
    };
    daemon = spawn(process.execPath, [
      cli,
      'playground',
      '--no-open',
      '--port',
      String(port),
      '--data-dir',
      dataRoot,
    ], { cwd: extracted, env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    daemon.stdout.setEncoding('utf8');
    daemon.stderr.setEncoding('utf8');
    daemon.stdout.on('data', (chunk) => stdout += chunk);
    daemon.stderr.on('data', (chunk) => stderr += chunk);
    await waitFor(() => stdout.includes('#bootstrap='), 20_000);
    const bootstrapUrl = stdout.trim().split(/\s+/u).find((value) =>
      value.startsWith('http://127.0.0.1:') && value.includes('#bootstrap=')
    );
    assert(bootstrapUrl, stderr);
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    browser = await chromium.launch({
      headless: true,
      args: ['--no-proxy-server'],
      ...(fs.existsSync(executablePath) ? { executablePath } : {}),
    });
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(bootstrapUrl);
    await page.waitForSelector('#new');
    const agents = await page.evaluate(async () =>
      await fetch('/api/agents', { credentials: 'same-origin' }).then(
        (response) => response.json(),
      )
    );
    assert.deepEqual(agents.agents.map((agent) => agent.id), ALL_IDS);
    assert.equal(
      agents.agents.every((agent) =>
        agent.available && agent.authentication === 'authenticated'
      ),
      true,
      JSON.stringify(agents.agents),
    );
    const ids = await page.locator('#localAgentAgent option').evaluateAll((
      options,
    ) => options.map((option) => option.getAttribute('value'))).catch(() => []);
    assert.deepEqual(ids, ALL_IDS);
    await verifyLocalConversationControls(page);
    await verifyModelControls(page);
    await verifySharedUiAndVisualSmoke(page, temporary);
    for (const agentId of ALL_IDS) {
      if (process.env.GENUI_DEBUG_UI_CONFORMANCE === '1') {
        console.error(`[ui-conformance] cancel ${agentId}`);
      }
      const { conversationId, turnId } = await startScenario(
        page,
        agentId,
        '[fixture:cancel]',
      );
      const responsePromise = page.waitForResponse((response) =>
        new URL(response.url()).pathname.endsWith(
          `/turns/${turnId}/cancellation`,
        )
      );
      await page.locator('#global-cancel').click();
      const response = await responsePromise;
      assert.equal(response.ok(), true);
      const body = await response.json();
      assert.equal(body.turn.id, turnId);
      assert.equal(body.turn.status, 'cancelled');
      const turn = await waitForTurn(
        dataRoot,
        conversationId,
        turnId,
        (value) => isTerminal(value.status),
      );
      assert.equal(turn.status, 'cancelled');
      await waitFor(() => descendantProcessIds(daemon.pid).length === 0);
      const events = readEvents(dataRoot, conversationId);
      assert.equal(terminalCount(events, turnId), 1);
      assert.equal(
        events.filter((event) =>
          event.turnId === turnId && event.type === 'artifact.ready'
        ).length,
        0,
      );
    }
    await verifyNativeReadyCancellation(
      page,
      dataRoot,
      daemon.pid,
      protocolLog,
    );
    await verifyAdmissionRace(page, dataRoot, daemon.pid);
    await verifyAwaitingApprovalCancellation(page, dataRoot, daemon.pid);
    for (const agentId of APPROVAL_IDS) {
      for (const decision of ['allow_once', 'deny']) {
        if (process.env.GENUI_DEBUG_UI_CONFORMANCE === '1') {
          console.error(`[ui-conformance] approval ${agentId} ${decision}`);
        }
        const { conversationId, turnId } = await startScenario(
          page,
          agentId,
          `[fixture:approval:${decision}]`,
        );
        const button = page.locator(
          `.localAgentApproval button[data-decision="${decision}"]`,
        );
        try {
          await button.waitFor({ state: 'visible', timeout: 10_000 });
        } catch (error) {
          const snapshot = await page.locator('body').innerText();
          throw new Error(
            `Missing ${decision} UI for ${agentId}: ${snapshot}`,
            { cause: error },
          );
        }
        const requestId = await button.evaluate((element) =>
          element.closest('.localAgentApproval')?.getAttribute(
            'data-approval-id',
          ) ?? ''
        );
        assert(requestId);
        const responsePromise = page.waitForResponse((response) =>
          new URL(response.url()).pathname.endsWith(`/approvals/${requestId}`)
        );
        await button.click();
        const response = await responsePromise;
        assert.equal(response.ok(), true);
        const responseBody = await response.json();
        assert.equal(responseBody.resolved, true);
        const turn = await waitForTurn(
          dataRoot,
          conversationId,
          turnId,
          (value) => isTerminal(value.status),
        );
        assert.equal(turn.status, 'completed');
        await waitFor(() =>
          terminalCount(
            readEvents(dataRoot, conversationId),
            turnId,
          ) === 1
        );
        const events = readEvents(dataRoot, conversationId);
        assert.equal(
          events.filter((event) =>
            event.turnId === turnId && event.type === 'approval.requested'
          ).length,
          1,
        );
        assert.equal(
          events.filter((event) =>
            event.turnId === turnId && event.type === 'approval.resolved'
            && event.payload.decision === decision
          ).length,
          1,
        );
        assert.equal(terminalCount(events, turnId), 1);
        await waitFor(() => descendantProcessIds(daemon.pid).length === 0);
      }
    }
    assert.deepEqual(pageErrors, [], 'control UI emitted an unhandled error');
    return {
      transport: 'packaged-fake-protocol-daemon-http-sse-control-ui-playwright',
      cancellation: true,
      allowOnce: true,
      deny: true,
      uniqueTerminal: true,
      noLateArtifact: true,
      noOrphanProcesses: true,
      admissionRetry: true,
      awaitingApprovalCancellation: true,
      approvalActor: 'playwright-user-click',
      sharedUiParity: true,
      visualSmoke: true,
    };
  } finally {
    await browser?.close();
    if (daemon && daemon.exitCode === null) {
      daemon.kill('SIGINT');
      await Promise.race([
        new Promise((resolve) => daemon.once('close', resolve)),
        new Promise((resolve) => setTimeout(resolve, 10_000)),
      ]);
      if (daemon.exitCode === null) daemon.kill('SIGKILL');
    }
    if (process.env.GENUI_KEEP_UI_CONFORMANCE !== '1') {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  }
}

async function verifyLocalConversationControls(page) {
  const active = page.locator('.conversationListItem-active');
  const originalId = await active.getAttribute('data-id');
  assert(originalId);

  await active.getByRole('button', { name: 'Rename conversation' }).click();
  const rename = active.locator('.conversationRenameInput');
  await rename.fill('Local parity fixture');
  await rename.press('Enter');
  await assertTitle(page, originalId, 'Local parity fixture');

  const original = page.locator(
    `.conversationListItem[data-id="${originalId}"]`,
  );
  await assertDisabledAction(original, 'Share conversation');
  await assertDisabledAction(original, 'Delete conversation');

  await page.locator('#new').click();
  await page.waitForFunction((previous) => {
    // eslint-disable-next-line no-undef -- evaluated in the browser realm
    const current = document.querySelector('.conversationListItem-active')
      ?.getAttribute('data-id');
    return Boolean(current && current !== previous);
  }, originalId);
  await original.locator('.conversationListItemMain').click();
  await page.waitForFunction((expected) => {
    // eslint-disable-next-line no-undef -- evaluated in the browser realm
    return document.querySelector('.conversationListItem-active')
      ?.getAttribute('data-id') === expected;
  }, originalId);
}

async function assertTitle(page, conversationId, title) {
  await page.waitForFunction(({ conversationId, title }) => {
    // eslint-disable-next-line no-undef -- evaluated in the browser realm
    const item = document.querySelector(
      `.conversationListItem[data-id="${conversationId}"]`,
    );
    return item?.querySelector('.conversationListItemTitle')?.textContent
      === title;
  }, { conversationId, title });
}

async function assertDisabledAction(conversation, name) {
  const action = conversation.getByRole('button', { name });
  assert.equal(await action.isDisabled(), true);
  assert.match(
    await action.getAttribute('title'),
    /unavailable in local Agent mode/u,
  );
}

async function verifyModelControls(page) {
  const provider = page.locator('.chatProviderControl');
  await page.waitForFunction(() =>
    [...globalThis.document.querySelectorAll('#localAgentModel option')].some((
      option,
    ) => option.getAttribute('value') === 'fixture-model')
  );
  assert.equal(await page.locator('input#localAgentModel').count(), 0);
  assert.equal(await page.locator('.chatProviderConfig').count(), 0);
  assert.deepEqual(
    await provider.locator('select').evaluateAll((selects) =>
      selects.map((select) => ({
        id: select.id,
        label: select.getAttribute('aria-label'),
      }))
    ),
    [
      { id: 'localAgentAgent', label: 'Coding Agent' },
      { id: 'localAgentModel', label: 'Model' },
      { id: 'localAgentEffort', label: 'Reasoning effort' },
    ],
  );
  const controlLayout = await provider.evaluate((element) => {
    const agent = element.querySelector('#localAgentAgent');
    const model = element.querySelector('#localAgentModel');
    const effort = element.querySelector('#localAgentEffort');
    const fade = element.querySelector('.chatProviderSelectFade');
    const agentSlot = agent?.parentElement;
    const modelSlot = model?.parentElement;
    const effortSlot = effort?.parentElement;
    if (
      !(agent instanceof globalThis.HTMLElement)
      || !(model instanceof globalThis.HTMLElement)
      || !(effort instanceof globalThis.HTMLElement)
      || !(fade instanceof globalThis.HTMLElement)
      || !(agentSlot instanceof globalThis.HTMLElement)
      || !(modelSlot instanceof globalThis.HTMLElement)
      || !(effortSlot instanceof globalThis.HTMLElement)
    ) {
      return null;
    }
    const overlay = globalThis.getComputedStyle(fade, '::after');
    return {
      agentWidth: Math.round(agentSlot.getBoundingClientRect().width),
      modelWidth: Math.round(modelSlot.getBoundingClientRect().width),
      effortWidth: Math.round(effortSlot.getBoundingClientRect().width),
      overlayBackground: overlay.backgroundImage,
      overlayPointerEvents: overlay.pointerEvents,
      overlayRight: overlay.right,
    };
  });
  assert(controlLayout);
  assert(
    Math.abs(controlLayout.agentWidth - controlLayout.modelWidth) <= 1,
    JSON.stringify(controlLayout),
  );
  assert(
    Math.abs(controlLayout.modelWidth - controlLayout.effortWidth) <= 1,
    JSON.stringify(controlLayout),
  );
  assert.notEqual(controlLayout.overlayBackground, 'none');
  assert.equal(controlLayout.overlayPointerEvents, 'none');
  assert.equal(controlLayout.overlayRight, '20px');
  await page.selectOption('#localAgentModel', 'fixture-model');
  await page.waitForFunction(() =>
    JSON.stringify(
      [...globalThis.document.querySelectorAll('#localAgentEffort option')]
        .map((option) => option.getAttribute('value')),
    ) === JSON.stringify(['', 'low', 'medium'])
  );
  assert.deepEqual(
    await page.locator('#localAgentEffort option').evaluateAll((options) =>
      options.map((option) => option.getAttribute('value'))
    ),
    ['', 'low', 'medium'],
  );
  await page.selectOption('#localAgentEffort', 'medium');

  await page.selectOption('#localAgentAgent', 'claude');
  await page.waitForFunction(() => {
    const model = globalThis.document.querySelector('#localAgentModel');
    return model?.disabled === true
      && model.querySelector('option')?.textContent === 'Agent default';
  });
  assert.equal(await page.locator('#localAgentModel').isDisabled(), true);
  assert.equal(await page.locator('#localAgentModel').inputValue(), '');
  assert.equal(
    await page.locator('#localAgentModel option').textContent(),
    'Agent default',
  );
  assert.equal(await page.locator('#localAgentEffort').inputValue(), '');
  assert.match(
    await page.locator('#localAgentModel').getAttribute('title'),
    /does not expose a model list/u,
  );

  const traeRoute = '**/api/agents/trae/models';
  await page.route(traeRoute, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.continue();
  });
  await page.selectOption('#localAgentAgent', 'trae');
  assert.equal(await page.locator('#localAgentModel').isDisabled(), true);
  assert.equal(
    await page.locator('#localAgentModel option').textContent(),
    'Loading models…',
  );
  await page.waitForFunction(() =>
    [...globalThis.document.querySelectorAll('#localAgentModel option')].some((
      option,
    ) => option.getAttribute('value') === 'fixture-model')
  );
  await page.unroute(traeRoute);
  assert.equal(await page.locator('#localAgentModel').isEnabled(), true);

  const cursorRoute = '**/api/agents/cursor/models';
  await page.route(cursorRoute, (route) =>
    route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'MODEL_DISCOVERY_FAILED', message: 'fixture failure' },
      }),
    }));
  await page.selectOption('#localAgentAgent', 'cursor');
  await page.waitForFunction(() =>
    globalThis.document.querySelector('#localAgentModel option')?.textContent
      ?.includes('models unavailable')
  );
  assert.equal(await page.locator('#localAgentModel').isDisabled(), true);
  await page.unroute(cursorRoute);
  await page.selectOption('#localAgentAgent', 'claude');
  await page.selectOption('#localAgentAgent', 'cursor');
  await page.waitForFunction(() =>
    [...globalThis.document.querySelectorAll('#localAgentModel option')].some((
      option,
    ) => option.getAttribute('value') === 'fixture-model')
  );
  assert.equal(await page.locator('#localAgentModel').isEnabled(), true);
  await page.selectOption('#localAgentAgent', 'codex');
  await page.waitForFunction(() =>
    [...globalThis.document.querySelectorAll('#localAgentModel option')].some((
      option,
    ) => option.getAttribute('value') === 'fixture-model')
  );
}

async function verifySharedUiAndVisualSmoke(page, temporary) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setTheme(page, 'light');
  const signature = await page.evaluate(() => {
    const describe = (selector) => {
      const element = globalThis.document.querySelector(selector);
      if (!(element instanceof globalThis.HTMLElement)) return null;
      const style = globalThis.getComputedStyle(element);
      return {
        tag: element.tagName.toLowerCase(),
        classes: [...element.classList],
        display: style.display,
        position: style.position,
      };
    };
    return {
      chrome: describe('.appShell'),
      topBar: describe('.topBar'),
      conversation: describe('.conversationPanel'),
      workspace: describe('.chatPageBody'),
      chat: describe('.chatPanel'),
      preview: describe('.previewPanel'),
      protocolDisabled: globalThis.document.querySelector('.protocolSelect')
        ?.disabled,
      newChatLabel: globalThis.document.querySelector('#new')
        ?.getAttribute('aria-label'),
      promptLabel: globalThis.document.querySelector('#prompt')
        ?.getAttribute('aria-label'),
    };
  });
  assert.deepEqual(signature.chrome?.classes, ['appShell']);
  assert.deepEqual(signature.topBar?.classes, ['topBar']);
  assert.equal(signature.topBar?.display, 'flex');
  assert.deepEqual(signature.conversation?.classes, ['conversationPanel']);
  assert.equal(signature.conversation?.display, 'flex');
  assert.deepEqual(signature.workspace?.classes, ['chatPageBody']);
  assert.equal(signature.workspace?.display, 'flex');
  assert.deepEqual(signature.chat?.classes, ['chatPanel']);
  assert.equal(signature.chat?.display, 'flex');
  assert.equal(signature.preview?.classes.includes('previewPanel'), true);
  assert.equal(signature.protocolDisabled, true);
  assert.equal(signature.newChatLabel, 'New Chat');
  assert.equal(
    signature.promptLabel,
    'Describe the Lynx XML interface to generate',
  );
  assert.equal(await composerNoticeGap(page), 10);

  const desktopLight = path.join(temporary, 'desktop-light.png');
  await page.screenshot({ path: desktopLight, fullPage: true });
  await setTheme(page, 'dark');
  const desktopDark = path.join(temporary, 'desktop-dark.png');
  await page.screenshot({ path: desktopDark, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await composerNoticeGap(page), 8);
  const mobileDark = path.join(temporary, 'mobile-dark.png');
  await page.screenshot({ path: mobileDark, fullPage: true });
  await setTheme(page, 'light');
  const mobileLight = path.join(temporary, 'mobile-light.png');
  await page.screenshot({ path: mobileLight, fullPage: true });

  for (
    const screenshot of [
      desktopLight,
      desktopDark,
      mobileDark,
      mobileLight,
    ]
  ) {
    assert(
      fs.statSync(screenshot).size > 1_000,
      `Empty screenshot: ${screenshot}`,
    );
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

async function composerNoticeGap(page) {
  return await page.evaluate(() => {
    const notice = globalThis.document.querySelector('.chatPrivacyNotice');
    const composer = globalThis.document.querySelector('.chatComposer');
    if (
      !(notice instanceof globalThis.HTMLElement)
      || !(composer instanceof globalThis.HTMLElement)
    ) {
      return -1;
    }
    return Math.round(
      composer.getBoundingClientRect().top
        - notice.getBoundingClientRect().bottom,
    );
  });
}

async function setTheme(page, theme) {
  const current = await page.locator('html').getAttribute('data-theme');
  if (current !== theme) {
    await page.getByRole('button', {
      name: `Switch to ${theme} mode`,
    }).click();
  }
  await page.waitForFunction((expected) => {
    return globalThis.document.documentElement.getAttribute('data-theme')
      === expected;
  }, theme);
}

async function startScenario(page, agentId, prompt) {
  const priorIds = await page.locator('.conversationListItem').evaluateAll((
    items,
  ) => items.map((item) => item.getAttribute('data-id')));
  await page.locator('#new').click();
  await page.waitForSelector('#prompt-form');
  await page.waitForFunction((existing) => {
    // eslint-disable-next-line no-undef -- evaluated in the browser realm
    const active = document.querySelector('.conversationListItem-active')
      ?.getAttribute('data-id');
    return Boolean(active && !existing.includes(active));
  }, priorIds);
  await page.selectOption('#localAgentAgent', agentId);
  const conversationId = await page.locator('.conversationListItem-active')
    .getAttribute('data-id');
  assert(conversationId);
  await page.fill('#prompt', prompt);
  await page.locator('#prompt-form button[type="submit"]').click();
  await page.waitForFunction(() => {
    // eslint-disable-next-line no-undef -- evaluated in the browser realm
    const control = document.querySelector('#global-cancel');
    return Boolean(control?.getAttribute('data-active-turn-id'));
  });
  const control = page.locator('#global-cancel');
  const turnId = await control.getAttribute('data-active-turn-id');
  assert(turnId);
  assert.equal(
    await control.getAttribute('data-active-conversation-id'),
    conversationId,
  );
  return { conversationId, turnId };
}

async function verifyAdmissionRace(page, dataRoot, daemonPid) {
  if (process.env.GENUI_DEBUG_UI_CONFORMANCE === '1') {
    console.error('[ui-conformance] terminal-before-close admission race');
  }
  const first = await startScenario(page, 'codex', '[fixture:delay-close]');
  await waitForTurn(
    dataRoot,
    first.conversationId,
    first.turnId,
    (turn) => turn.status === 'completed',
  );
  await page.waitForSelector('#prompt-form button[type="submit"]');
  const requests = [];
  const responses = [];
  const onRequest = (request) => {
    if (new URL(request.url()).pathname.includes('/turns/')) {
      requests.push({ url: request.url(), body: request.postData() });
    }
  };
  const onResponse = (response) => {
    if (new URL(response.url()).pathname.includes('/turns/')) {
      responses.push(response.status());
    }
  };
  page.on('request', onRequest);
  page.on('response', onResponse);
  await page.fill('#prompt', '[fixture:cancel-after-admission-race]');
  const cancellationResponse = page.waitForResponse((response) =>
    response.request().method() === 'PUT'
    && new URL(response.url()).pathname.endsWith('/cancellation')
  );
  await page.locator('#prompt-form button[type="submit"]').click();
  await page.waitForFunction(() =>
    Boolean(
      // eslint-disable-next-line no-undef -- evaluated in the browser realm
      document.querySelector('#global-cancel')?.getAttribute(
        'data-active-turn-id',
      ),
    )
  );
  const turnId = await page.locator('#global-cancel').getAttribute(
    'data-active-turn-id',
  );
  assert(turnId);
  await page.locator('#global-cancel').click();
  const cancellation = await cancellationResponse;
  assert.equal(cancellation.ok(), true);
  const cancellationBody = await cancellation.json();
  assert.equal(cancellationBody.turn.id, turnId);
  assert.equal(cancellationBody.turn.status, 'cancelled');
  const turn = await waitForTurn(
    dataRoot,
    first.conversationId,
    turnId,
    (candidate) => isTerminal(candidate.status),
  );
  assert.equal(turn.status, 'cancelled');
  await waitFor(() => descendantProcessIds(daemonPid).length === 0);
  page.off('request', onRequest);
  page.off('response', onResponse);
  const turnRequests = requests.filter((request) =>
    new URL(request.url).pathname.endsWith(`/turns/${turnId}`)
  );
  assert(turnRequests.length > 1, 'admission race did not exercise a retry');
  assert.equal(responses.includes(409), true);
  assert.equal(
    new Set(turnRequests.map((request) => request.url)).size,
    1,
  );
  assert.equal(
    new Set(turnRequests.map((request) => request.body)).size,
    1,
  );
  const events = readEvents(dataRoot, first.conversationId);
  assert.equal(terminalCount(events, turnId), 1);
  assert.equal(
    events.filter((event) =>
      event.turnId === turnId && event.type === 'artifact.ready'
    ).length,
    0,
  );
}

async function verifyNativeReadyCancellation(
  page,
  dataRoot,
  daemonPid,
  protocolLog,
) {
  for (const agentId of ['codex', 'cursor', 'trae']) {
    if (process.env.GENUI_DEBUG_UI_CONFORMANCE === '1') {
      console.error(`[ui-conformance] native-ready cancel ${agentId}`);
    }
    const marker = `[fixture:native-ready:${agentId}:${Date.now()}]`;
    const scenario = await startScenario(
      page,
      agentId,
      `[fixture:cancel-native-late-artifact] ${marker}`,
    );
    await waitFor(() =>
      fs.existsSync(protocolLog)
      && fs.readFileSync(protocolLog, 'utf8').includes(marker)
    );
    const { conversationId, turnId } = scenario;
    const responsePromise = page.waitForResponse((response) =>
      response.request().method() === 'PUT'
      && new URL(response.url()).pathname.endsWith(
        `/turns/${turnId}/cancellation`,
      )
    );
    await page.locator('#global-cancel').evaluate((element) => element.click());
    const response = await responsePromise;
    assert.equal(response.ok(), true);
    const responseBody = await response.json();
    assert.equal(responseBody.turn.id, turnId);
    assert.equal(responseBody.turn.status, 'cancelled');
    const turn = await waitForTurn(
      dataRoot,
      conversationId,
      turnId,
      (value) => isTerminal(value.status),
    );
    assert.equal(turn.status, 'cancelled');
    await waitFor(() => descendantProcessIds(daemonPid).length === 0);
    const events = readEvents(dataRoot, conversationId);
    assert.equal(terminalCount(events, turnId), 1);
    assert.equal(
      events.filter((event) =>
        event.turnId === turnId && event.type === 'artifact.ready'
      ).length,
      0,
    );
  }
}

async function verifyAwaitingApprovalCancellation(page, dataRoot, daemonPid) {
  if (process.env.GENUI_DEBUG_UI_CONFORMANCE === '1') {
    console.error('[ui-conformance] awaiting-approval cancellation');
  }
  const { conversationId, turnId } = await startScenario(
    page,
    'cursor',
    '[fixture:approval:cancel]',
  );
  await page.locator('.localAgentApproval').waitFor({ state: 'visible' });
  const responsePromise = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith(
      `/turns/${turnId}/cancellation`,
    )
  );
  await page.locator('#global-cancel').click();
  const response = await responsePromise;
  assert.equal(response.ok(), true);
  const turn = await waitForTurn(
    dataRoot,
    conversationId,
    turnId,
    (value) => isTerminal(value.status),
  );
  assert.equal(turn.status, 'cancelled');
  await waitFor(() => descendantProcessIds(daemonPid).length === 0);
  const events = readEvents(dataRoot, conversationId);
  assert.equal(
    events.filter((event) =>
      event.turnId === turnId && event.type === 'approval.requested'
    ).length,
    1,
  );
  assert.equal(
    events.filter((event) =>
      event.turnId === turnId && event.type === 'approval.resolved'
    ).length,
    0,
  );
  assert.equal(terminalCount(events, turnId), 1);
  assert.equal(
    events.filter((event) =>
      event.turnId === turnId && event.type === 'artifact.ready'
    ).length,
    0,
  );
}

function installFakeAgents(bin) {
  for (const command of ['codex', 'claude', 'cursor-agent', 'traecli']) {
    fs.writeFileSync(
      path.join(bin, command),
      fakeAgentSource(command),
      { mode: 0o700 },
    );
  }
}

function fakeAgentSource(command) {
  return `#!/usr/bin/env node
import fs from 'node:fs';
const name=${JSON.stringify(command)};
if(process.argv.includes('status')||process.argv.includes('auth')){console.log('authenticated');process.exit(0)}
if(process.argv.includes('--list-models')){console.log('Available models\\n\\nfixture-model - Fixture Model');process.exit(0)}
if(process.argv.includes('models')){console.log(JSON.stringify({models:['fixture-model']}));process.exit(0)}
const artifact=${JSON.stringify(ARTIFACT)};
let input=''; let protocol=name==='codex'?'codex':name==='claude'?'claude':'acp'; let prompt='';
function send(value){console.log(JSON.stringify(value))}
function log(value){if(process.env.GENUI_FAKE_PROTOCOL_LOG)fs.appendFileSync(process.env.GENUI_FAKE_PROTOCOL_LOG,value+'\\n')}
function finish(){if(protocol==='codex'){send({method:'item/completed',params:{item:{type:'agent_message',text:artifact}}});send({method:'turn/completed',params:{turn:{status:'completed'}}})}else if(protocol==='acp'){send({method:'session/update',params:{update:{sessionUpdate:'agent_message_chunk',text:artifact}}});send({id:3,result:{stopReason:'end_turn'}})}else{send({type:'result',result:artifact})}}
process.on('SIGTERM',()=>{if(!prompt.includes('[fixture:delay-close]'))process.exit(0)});
process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>{input+=chunk;for(;;){const end=input.indexOf('\\n');if(end<0)break;const line=input.slice(0,end);input=input.slice(end+1);if(!line)continue;const m=JSON.parse(line);
if(protocol==='claude'){prompt=JSON.stringify(m);if(prompt.includes('[fixture:cancel')){}else finish();continue}
if(m.id===1){send({id:1,result:protocol==='acp'?{agentCapabilities:{tools:true,permissions:true,cancellation:true}}:{}});continue}
if(protocol==='codex'&&m.method==='model/list'){send({id:m.id,result:{data:[{id:'fixture-model',model:'fixture-model',displayName:'Fixture Model',hidden:false,isDefault:true,defaultReasoningEffort:'medium',supportedReasoningEfforts:[{reasoningEffort:'low',description:'Low'},{reasoningEffort:'medium',description:'Medium'}]}],nextCursor:null}});continue}
if(protocol==='codex'&&m.id===2){send({id:2,result:{thread:{id:'thread'}}});continue}
if(protocol==='codex'&&m.id===3){prompt=JSON.stringify(m.params);send({id:3,result:{turn:{id:'turn'}}});log(name+':native-ready '+prompt);if(prompt.includes('[fixture:approval:'))send({id:45,method:'item/commandExecution/requestApproval',params:{title:'Fixture approval'}});else if(!prompt.includes('[fixture:cancel'))finish();continue}
if(protocol==='acp'&&m.id===2){send({id:2,result:{sessionId:'session'}});continue}
if(protocol==='acp'&&m.id===3){prompt=JSON.stringify(m.params);log(name+':native-ready '+prompt);if(prompt.includes('[fixture:approval:'))send({id:45,method:'session/request_permission',params:{title:'Fixture approval',options:[{optionId:'allow-token',kind:'allow_once'},{optionId:'deny-token',kind:'reject_once'}]}});else if(!prompt.includes('[fixture:cancel'))finish();continue}
if(m.id===45){finish();continue}
if(m.method==='turn/interrupt'||m.method==='session/cancel'){if(prompt.includes('[fixture:cancel-native-late-artifact]'))setTimeout(finish,25);setTimeout(()=>process.exit(0),50)}
}});
process.stdin.on('end',()=>{if(protocol==='claude'&&!prompt.includes('[fixture:cancel'))finish()});
setInterval(()=>{},1000);
`;
}

function readEvents(dataRoot, conversationId) {
  const file = path.join(dataRoot, 'sessions', conversationId, 'events.jsonl');
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean)
    .map((line) => JSON.parse(line));
}

function terminalCount(events, turnId) {
  return events.filter((event) =>
    event.turnId === turnId && [
      'turn.completed',
      'turn.failed',
      'turn.cancelled',
      'turn.interrupted',
    ].includes(event.type)
  ).length;
}

async function waitForTurn(
  dataRoot,
  conversationId,
  turnId,
  predicate = () => true,
) {
  let turn;
  await waitFor(() => {
    try {
      turn = JSON.parse(fs.readFileSync(
        path.join(
          dataRoot,
          'sessions',
          conversationId,
          'turns',
          `${turnId}.json`,
        ),
        'utf8',
      ));
      return predicate(turn);
    } catch {
      return false;
    }
  });
  return turn;
}

function descendantProcessIds(parentPid) {
  const rows = execFileSync('ps', ['-axo', 'pid=,ppid='], { encoding: 'utf8' })
    .trim().split('\n').map((line) => line.trim().split(/\s+/u).map(Number));
  const descendants = new Set([parentPid]);
  for (let pass = rows.length; pass > 0; pass -= 1) {
    for (const [pid, ppid] of rows) {
      if (descendants.has(ppid)) descendants.add(pid);
    }
  }
  descendants.delete(parentPid);
  return [...descendants];
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

function isTerminal(status) {
  return ['completed', 'failed', 'cancelled', 'interrupted'].includes(status);
}

async function waitFor(predicate, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out after ${timeoutMs} ms`);
}

if (pathToFileURL(process.argv[1]).href === import.meta.url) {
  const packageRoot = fileURLToPath(new URL('../..', import.meta.url));
  console.info(
    JSON.stringify(await runPackagedUiConformance(packageRoot), null, 2),
  );
}
