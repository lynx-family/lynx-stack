// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import '@lynx-js/web-elements/index.css';

import { isPreviewArtifactMessage } from './preview-channel.js';
import './preview.css';

const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;

void mountPreview();

async function mountPreview(): Promise<void> {
  document.title = 'Lynx isolated preview';
  document.body.className = 'preview-body';
  const status = document.createElement('div');
  status.id = 'preview-status';
  status.textContent = 'Waiting for a validated artifact…';
  document.body.replaceChildren(status);
  const parameters = new URLSearchParams(location.search);
  const conversationId = parameters.get('conversationId');
  const revision = parameters.get('revision');
  const hash = parameters.get('hash');
  const nonce = parameters.get('nonce');
  const controlOrigin = parameters.get('controlOrigin');
  if (
    !conversationId
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
      .test(conversationId)
    || !revision || !/^[1-9]\d*$/u.test(revision) || !hash
    || !/^[0-9a-f]{64}$/u.test(hash) || !nonce
    || !/^[0-9a-f-]{36}$/iu.test(nonce)
    || !controlOrigin
    || !/^http:\/\/127\.0\.0\.1:\d+$/u.test(controlOrigin)
  ) {
    renderFatal('Invalid preview handshake.');
    return;
  }
  let consumed = false;
  const capability = { conversationId, revision, hash, nonce };
  window.addEventListener('message', (event) => {
    if (
      consumed
      || !isPreviewArtifactMessage(
        event,
        controlOrigin,
        window.parent,
        capability,
      )
    ) return;
    const source = (event as unknown as { data: { source: unknown } }).data
      .source;
    if (
      typeof source !== 'string'
      || new TextEncoder().encode(source).byteLength > MAX_ARTIFACT_BYTES
      || !source.startsWith('<!doctype lynx>')
      || !source.trimEnd().endsWith('</lynx>')
    ) {
      renderFatal('Rejected invalid preview artifact.');
      consumed = true;
      return;
    }
    consumed = true;
    void verifyHash(source, hash).then((valid) => {
      if (valid) void renderLynxXml(source);
      else renderFatal('Rejected artifact with a mismatched revision hash.');
    });
  });
  window.parent.postMessage({
    type: 'genui-preview-ready',
    nonce,
    conversationId,
    revision,
    hash,
  }, controlOrigin);
}

async function renderLynxXml(source: string): Promise<void> {
  await import('@lynx-js/web-core/client');
  await import('@lynx-js/web-elements/all');
  const blobUrl = URL.createObjectURL(
    new Blob([source], { type: 'application/xml' }),
  );
  const lynxView = document.createElement('lynx-view') as HTMLElement & {
    url?: string;
  };
  lynxView.className = 'isolated-lynx-view';
  lynxView.addEventListener('load', () => URL.revokeObjectURL(blobUrl), {
    once: true,
  });
  lynxView.addEventListener(
    'error',
    () => renderFatal('Lynx could not render this artifact.'),
    { once: true },
  );
  document.body.replaceChildren(lynxView);
  lynxView.url = blobUrl;
}

async function verifyHash(source: string, expected: string): Promise<boolean> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(source),
  );
  const actual = [...new Uint8Array(digest)].map((byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  return actual === expected;
}

function renderFatal(message: string): void {
  const main = document.createElement('main');
  main.className = 'localAgentPreviewFatal';
  const heading = document.createElement('h1');
  heading.textContent = 'GenUI Preview';
  const body = document.createElement('p');
  body.textContent = message;
  main.append(heading, body);
  document.body.replaceChildren(main);
}
