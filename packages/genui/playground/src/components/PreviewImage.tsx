// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useEffect, useId, useState } from 'react';

import { Button } from './Button.js';
import { ArrowUpRight, ChevronDown, RotateCcw, Smartphone, X } from './Icon.js';
import './PreviewImage.css';

export interface PreviewImageSettings {
  endpoint: string;
  width: number;
  height: number;
  screenshotSettleMs: number;
  timeoutMs: number;
}

interface PreviewImageProps {
  active?: boolean;
  sourceKey: string;
  phoneSize: { width: number; height: number };
  capture: (
    settings: PreviewImageSettings,
    signal: AbortSignal,
  ) => Promise<string>;
  unavailableReason?: string;
}

function validateSettings(settings: PreviewImageSettings): string | undefined {
  try {
    const endpoint = new URL(settings.endpoint);
    if (
      !['http:', 'https:'].includes(endpoint.protocol)
      || endpoint.username || endpoint.password || endpoint.search
      || endpoint.hash
    ) {
      return 'Use an HTTP(S) endpoint without credentials, query parameters, or a fragment.';
    }
  } catch {
    return 'Enter a valid UI Judge endpoint URL.';
  }
  if (
    !Number.isInteger(settings.width) || settings.width < 1
    || settings.width > 8192 || !Number.isInteger(settings.height)
    || settings.height < 1 || settings.height > 8192
  ) {
    return 'Screen width and height must be whole numbers from 1 to 8192 px.';
  }
  if (settings.width * settings.height > 2_621_440) {
    return 'Screen size must not exceed 2,621,440 pixels in total.';
  }
  if (
    !Number.isInteger(settings.timeoutMs) || settings.timeoutMs < 1
    || settings.timeoutMs > 300_000
  ) {
    return 'Timeout must be a whole number from 1 to 300,000 ms.';
  }
  if (
    !Number.isInteger(settings.screenshotSettleMs)
    || settings.screenshotSettleMs < 0
    || settings.screenshotSettleMs >= settings.timeoutMs
  ) {
    return 'Screenshot delay must be a non-negative whole number less than the timeout.';
  }
  return undefined;
}

export function PreviewImage({
  active = true,
  sourceKey,
  phoneSize,
  capture,
  unavailableReason,
}: PreviewImageProps) {
  const settingsId = useId();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [endpoint, setEndpoint] = useState(
    'https://server-render.lynx-stack.dev/',
  );
  const [dimensions, setDimensions] = useState<
    { width: string; height: string } | null
  >(null);
  const [delay, setDelay] = useState('2000');
  const [timeout, setTimeoutValue] = useState('30000');
  const [request, setRequest] = useState<
    { key: string; controller: AbortController } | null
  >(null);
  const [failure, setFailure] = useState<
    { key: string; message: string } | null
  >(null);
  const [cancelledKey, setCancelledKey] = useState<string | null>(null);
  const [result, setResult] = useState<
    { key: string; url: string; width: number; height: number } | null
  >(null);
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>(
    'loading',
  );

  const width = dimensions?.width ?? String(phoneSize.width || '');
  const height = dimensions?.height ?? String(phoneSize.height || '');
  const settings: PreviewImageSettings = {
    endpoint: endpoint.trim(),
    width: Number(width),
    height: Number(height),
    screenshotSettleMs: Number(delay),
    timeoutMs: Number(timeout),
  };
  const requestKey = JSON.stringify([sourceKey, settings]);
  const pending = active && request?.key === requestKey
    && !request.controller.signal.aborted;
  const stale = result !== null && result.key !== requestKey;
  let validationError = validateSettings(settings);
  if (!dimensions && (!phoneSize.width || !phoneSize.height)) {
    validationError = 'Waiting for the phone screen dimensions.';
  } else if (delay.trim() === '') {
    validationError = 'Enter a screenshot delay in milliseconds.';
  }
  const captureError = failure?.key === requestKey
    ? failure.message
    : undefined;
  const blockedReason = unavailableReason ?? validationError;

  useEffect(() => {
    if (!active || request?.key !== requestKey) request?.controller.abort();
    return () => {
      request?.controller.abort();
    };
  }, [active, request, requestKey]);

  const startCapture = async () => {
    if (!active || pending || blockedReason) return;
    const controller = new AbortController();
    setRequest({ key: requestKey, controller });
    setFailure(null);
    setCancelledKey(null);
    try {
      const url = await capture(settings, controller.signal);
      if (controller.signal.aborted) return;
      setResult({
        key: requestKey,
        url,
        width: settings.width,
        height: settings.height,
      });
      setImageState('loading');
    } catch (error) {
      if (controller.signal.aborted) return;
      setFailure({
        key: requestKey,
        message: error instanceof Error
          ? error.message
          : 'Screenshot capture failed.',
      });
    } finally {
      setRequest((current) =>
        current?.controller === controller ? null : current
      );
    }
  };

  let status = 'Capture the current preview with native Lynx.';
  if (pending) {
    status = 'Capturing native screenshot…';
  } else if (blockedReason) {
    status = blockedReason;
  } else if (stale) {
    status = 'Preview or settings changed. Recapture to update the image.';
  } else if (cancelledKey === requestKey) {
    status = 'Capture cancelled.';
  } else if (result) {
    status = imageState === 'loading'
      ? 'Loading screenshot…'
      : `${result.width} × ${result.height} px · Native Lynx`;
  }

  return (
    <section className='previewImage' aria-label='Native screenshot'>
      <div className='previewImageControls'>
        <div className='previewImageToolbar'>
          <Button
            variant='primary'
            size='sm'
            iconBefore={result ? RotateCcw : Smartphone}
            disabled={pending || !!blockedReason}
            onClick={() => void startCapture()}
          >
            {pending ? 'Capturing…' : (result ? 'Recapture' : 'Capture')}
          </Button>
          {pending && (
            <Button
              variant='ghost'
              size='sm'
              iconBefore={X}
              onClick={() => {
                request?.controller.abort();
                setRequest(null);
                setCancelledKey(requestKey);
              }}
            >
              Cancel
            </Button>
          )}
          {result && (
            <a
              className='previewImageLink'
              href={result.url}
              target='_blank'
              rel='noopener noreferrer'
              title='Open screenshot in a new tab'
            >
              Open image <ArrowUpRight size={14} aria-hidden='true' />
            </a>
          )}
          <Button
            className='previewImageSettingsToggle'
            variant='ghost'
            size='sm'
            iconAfter={ChevronDown}
            aria-expanded={settingsOpen}
            aria-controls={settingsId}
            onClick={() => setSettingsOpen(!settingsOpen)}
          >
            Settings
          </Button>
        </div>
        <div
          id={settingsId}
          className='previewImageSettings'
          hidden={!settingsOpen}
        >
          <label className='previewImageEndpoint'>
            UI Judge endpoint
            <input
              type='url'
              value={endpoint}
              placeholder='https://server-render.lynx-stack.dev/'
              spellCheck={false}
              autoComplete='off'
              onChange={(event) => setEndpoint(event.target.value)}
            />
          </label>
          <label>
            Width (px)
            <input
              type='number'
              min={1}
              max={8192}
              step={1}
              value={width}
              onChange={(event) =>
                setDimensions({ width: event.target.value, height })}
            />
          </label>
          <label>
            Height (px)
            <input
              type='number'
              min={1}
              max={8192}
              step={1}
              value={height}
              onChange={(event) =>
                setDimensions({ width, height: event.target.value })}
            />
          </label>
          <label>
            Screenshot delay (ms)
            <input
              type='number'
              min={0}
              max={299999}
              step={1}
              value={delay}
              onChange={(event) => setDelay(event.target.value)}
            />
          </label>
          <label>
            Timeout (ms)
            <input
              type='number'
              min={1}
              max={300000}
              step={1}
              value={timeout}
              onChange={(event) => setTimeoutValue(event.target.value)}
            />
          </label>
          <div className='previewImageSettingsFooter'>
            <Button
              size='sm'
              variant='secondary'
              onClick={() => setDimensions(null)}
            >
              Use phone size
            </Button>
            <span>Delay lets the page settle before capture.</span>
          </div>
        </div>
        <p className='previewImageStatus' role='status'>{status}</p>
        {captureError && (
          <p className='previewImageError' role='alert'>{captureError}</p>
        )}
        {result && imageState === 'error' && (
          <p className='previewImageError' role='alert'>
            The screenshot could not be displayed. Open the image or recapture
            to retry.
          </p>
        )}
      </div>
      <div className='previewImageCanvas' aria-busy={pending}>
        {result
          ? (
            <img
              key={result.url}
              className={stale
                ? 'previewImageCapture previewImageCaptureStale'
                : 'previewImageCapture'}
              src={result.url}
              width={result.width}
              height={result.height}
              alt={`Native Lynx screenshot, ${result.width} by ${result.height} pixels${
                stale ? ', from the previous preview or settings' : ''
              }`}
              hidden={imageState === 'error'}
              referrerPolicy='no-referrer'
              onLoad={() => setImageState('loaded')}
              onError={() => setImageState('error')}
            />
          )
          : (
            <div className='previewImageEmpty'>
              <Smartphone size={28} strokeWidth={1.5} aria-hidden='true' />
              <strong>
                {pending ? 'Rendering on native Lynx' : 'Native screenshot'}
              </strong>
              <span>
                {pending
                  ? 'The image will appear here when capture finishes.'
                  : 'Capture a still image with the current phone dimensions, or customize them in Settings.'}
              </span>
            </div>
          )}
      </div>
    </section>
  );
}
