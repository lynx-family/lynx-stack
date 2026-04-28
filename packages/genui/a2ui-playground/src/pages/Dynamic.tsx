// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Chip } from '../components/Chip.js';
import { MobilePreview } from '../components/MobilePreview.js';
import { QrCode } from '../components/QrCode.js';
import { UsageSection } from '../components/UsageSection.js';
import { DYNAMIC_PRESETS } from '../demos.js';
import type { ProtocolVersion } from '../utils/protocol.js';
import { buildRenderUrl } from '../utils/renderUrl.js';

type Mode = 'preset' | 'custom';

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? [], null, 2);
}

export function DynamicPage(
  props: { protocol: ProtocolVersion; demoUrl: string },
) {
  const { protocol, demoUrl } = props;

  const hasPresets = DYNAMIC_PRESETS.length > 0;
  const [mode, setMode] = useState<Mode>(hasPresets ? 'preset' : 'custom');
  const [presetId, setPresetId] = useState<string>(
    DYNAMIC_PRESETS[0]?.id ?? '',
  );
  const [customJson, setCustomJson] = useState<string>(() => {
    const first = DYNAMIC_PRESETS[0]?.messages ?? [];
    return formatJson(first);
  });
  const customJsonEditedRef = useRef(false);
  const [error, setError] = useState<string>('');
  const [renderUrl, setRenderUrl] = useState<string>('');

  const baseUrl = window.location.href.replace(/#.*$/, '');
  const homeHref = `#/${protocol}`;

  const currentPreset = useMemo(() => {
    return DYNAMIC_PRESETS.find((p) => p.id === presetId) ?? DYNAMIC_PRESETS[0];
  }, [presetId]);

  const presetMessages = currentPreset?.messages;
  const presetActions = currentPreset?.actionMocks;

  useEffect(() => {
    if (customJsonEditedRef.current) return;
    setCustomJson(formatJson(presetMessages ?? []));
  }, [presetMessages]);

  const handleStart = useCallback(() => {
    setError('');

    if (mode === 'preset') {
      if (!currentPreset) {
        setError('No preset selected');
        return;
      }

      const url = buildRenderUrl(
        {
          protocol,
          demoUrl,
          messages: presetMessages,
          actionMocks: presetActions,
        },
        baseUrl,
      );
      setRenderUrl(url);
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(customJson);
    } catch (e) {
      setError(`Invalid JSON: ${String(e)}`);
      return;
    }

    const url = buildRenderUrl(
      {
        protocol,
        demoUrl,
        messages: parsed,
      },
      origin,
    );
    setRenderUrl(url);
  }, [
    customJson,
    currentPreset,
    demoUrl,
    mode,
    baseUrl,
    presetActions,
    presetMessages,
    protocol,
  ]);

  const handleSwitchToPreset = useCallback(() => {
    if (!hasPresets) return;
    setMode('preset');
    setError('');
  }, [hasPresets]);

  const handleSwitchToCustom = useCallback(() => {
    setMode('custom');
    setError('');

    const trimmed = customJson.trim();
    if (trimmed === '' || trimmed === '[]') {
      setCustomJson(formatJson(presetMessages ?? []));
      customJsonEditedRef.current = false;
    }
  }, [customJson, presetMessages]);

  const handleFillExample = useCallback(() => {
    setMode('custom');
    setError('');
    setCustomJson(formatJson(presetMessages ?? []));
    customJsonEditedRef.current = false;
  }, [presetMessages]);

  const handleClear = useCallback(() => {
    setCustomJson('[]');
    setRenderUrl('');
    setError('');
    customJsonEditedRef.current = false;
  }, []);

  return (
    <div className='page'>
      <div className='pageHeader'>
        <a className='backLink' href={homeHref}>
          ← Back to Home
        </a>
        <h1 className='pageTitle'>Dynamic Rendering</h1>
        <p className='pageSubtitle'>
          Presets and custom JSON, with action triggering and incremental
          updates.
        </p>
      </div>

      <div className='dynamicLayout'>
        <div className='dynamicLeft'>
          <div
            className='segmented'
            role='tablist'
            aria-label='Dynamic demo mode'
          >
            {hasPresets
              ? (
                <button
                  type='button'
                  className={mode === 'preset' ? 'segment active' : 'segment'}
                  onClick={handleSwitchToPreset}
                >
                  Presets
                </button>
              )
              : null}
            <button
              type='button'
              className={mode === 'custom' ? 'segment active' : 'segment'}
              onClick={handleSwitchToCustom}
            >
              Custom JSON
            </button>
          </div>

          {mode === 'preset' && hasPresets
            ? (
              <div className='panel'>
                <div className='panelTitle'>Choose a Preset</div>
                <select
                  className='select'
                  value={presetId}
                  onChange={(e) => setPresetId(e.target.value)}
                >
                  {DYNAMIC_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>

                {currentPreset
                  ? (
                    <div className='presetMeta'>
                      <div className='presetDesc'>
                        {currentPreset.description}
                      </div>
                      <div className='chipRow'>
                        {currentPreset.tags.map((t) => <Chip key={t}>{t}
                        </Chip>)}
                      </div>
                    </div>
                  )
                  : null}
              </div>
            )
            : (
              <div className='panel'>
                <div className='panelTitle'>A2UI messages JSON</div>
                <textarea
                  className='editor'
                  value={customJson}
                  onChange={(e) => {
                    setCustomJson(e.target.value);
                    customJsonEditedRef.current = true;
                  }}
                  spellCheck={false}
                />
              </div>
            )}

          <div className='buttonRow'>
            <button
              type='button'
              className='button primary'
              onClick={handleStart}
            >
              Start Rendering
            </button>
            <button
              type='button'
              className='button'
              onClick={handleFillExample}
            >
              Fill Example
            </button>
          </div>

          <div className='buttonRow'>
            <button type='button' className='button' onClick={handleClear}>
              Clear
            </button>
          </div>

          {error ? <div className='error'>{error}</div> : null}
        </div>

        <div className='dynamicRight'>
          <div className='previewTop'>
            <div className='previewTitle'>Preview</div>
            {renderUrl
              ? (
                <div className='qrInline'>
                  <div className='qrLabel'>View on Device</div>
                  <QrCode value={renderUrl} size={116} />
                </div>
              )
              : null}
          </div>

          <div className='previewBody'>
            {renderUrl
              ? <MobilePreview src={renderUrl} />
              : (
                <div className='previewEmpty'>
                  <div className='previewEmptyIcon'>⚡</div>
                  <div>Pick a preset or paste custom JSON</div>
                  <div className='previewEmptySub'>
                    Click "Start Rendering" to preview
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>

      <UsageSection />
    </div>
  );
}
