// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useEffect, useState } from 'react';
import type { Ref } from 'react';

import { isPreviewReadyMessage } from './preview-channel.js';
import type { PreviewCapability } from './preview-channel.js';

const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;

export interface IsolatedLynxXmlFrameProps {
  source: string;
  identity: string;
  previewOrigin: string;
  conversationId?: string;
  revision?: string;
  hash?: string;
  className: string;
  title: string;
  iframeRef?: Ref<HTMLIFrameElement> | undefined;
  onLoad?: (() => void) | undefined;
}

interface FrameState extends PreviewCapability {
  src: string;
}

interface FrameRequest {
  conversationId?: string | undefined;
  hash?: string | undefined;
  identity: string;
  previewOrigin: string;
  revision?: string | undefined;
  source: string;
}

export function IsolatedLynxXmlFrame(props: IsolatedLynxXmlFrameProps) {
  const [frameState, setFrameState] = useState<FrameState | null>(null);
  const [error, setError] = useState('');
  const {
    conversationId,
    hash,
    identity,
    previewOrigin,
    revision,
    source,
  } = props;

  useEffect(() => {
    let active = true;
    setFrameState(null);
    setError('');
    void createFrameState({
      conversationId,
      hash,
      identity,
      previewOrigin,
      revision,
      source,
    }).then(
      (value) => {
        if (active) setFrameState(value);
      },
      (caught) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      },
    );
    return () => {
      active = false;
    };
  }, [
    conversationId,
    hash,
    identity,
    previewOrigin,
    revision,
    source,
  ]);

  if (error) {
    return (
      <div className={`${props.className} localAgentPreviewError`}>
        {error}
      </div>
    );
  }

  if (!frameState) {
    return (
      <div className={`${props.className} localAgentPreviewPending`}>
        Preparing isolated preview…
      </div>
    );
  }

  return (
    <IsolatedFrameDocument
      {...props}
      frameState={frameState}
    />
  );
}

function IsolatedFrameDocument(
  props: IsolatedLynxXmlFrameProps & { frameState: FrameState },
) {
  const {
    frameState,
    iframeRef,
    onLoad,
    previewOrigin,
    source,
  } = props;
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!frame) return;
    let consumed = false;
    const listener = (event: MessageEvent): void => {
      if (
        consumed
        || !isPreviewReadyMessage(
          event,
          previewOrigin,
          frame.contentWindow,
          frameState,
        )
      ) return;
      consumed = true;
      frame.contentWindow?.postMessage({
        type: 'genui-preview-artifact',
        nonce: frameState.nonce,
        conversationId: frameState.conversationId,
        revision: frameState.revision,
        hash: frameState.hash,
        source,
      }, previewOrigin);
      onLoad?.();
      window.removeEventListener('message', listener);
      window.clearTimeout(timeout);
    };
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', listener);
    }, 10_000);
    window.addEventListener('message', listener);
    return () => {
      window.removeEventListener('message', listener);
      window.clearTimeout(timeout);
    };
  }, [frame, frameState, onLoad, previewOrigin, source]);

  return (
    <iframe
      key={frameState.nonce}
      ref={(element) => {
        setFrame(element);
        assignRef(iframeRef, element);
      }}
      className={props.className}
      title={props.title}
      src={frameState.src}
      sandbox='allow-scripts allow-same-origin'
      referrerPolicy='no-referrer'
    />
  );
}

async function createFrameState(
  props: FrameRequest,
): Promise<FrameState> {
  if (new TextEncoder().encode(props.source).byteLength > MAX_ARTIFACT_BYTES) {
    throw new Error('Lynx XML artifact exceeds the 2 MiB preview limit');
  }
  const conversationId = props.conversationId ?? crypto.randomUUID();
  const revision = props.revision && /^[1-9]\d*$/u.test(props.revision)
    ? props.revision
    : '1';
  const hash = props.hash ?? await sha256(props.source);
  const nonce = crypto.randomUUID();
  const capability = { conversationId, revision, hash, nonce };
  const url = new URL('/', props.previewOrigin);
  url.searchParams.set('conversationId', conversationId);
  url.searchParams.set('revision', revision);
  url.searchParams.set('hash', hash);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('controlOrigin', location.origin);
  url.hash = props.identity;
  return { ...capability, src: url.toString() };
}

async function sha256(source: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(source),
  );
  return [...new Uint8Array(digest)].map((byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}
