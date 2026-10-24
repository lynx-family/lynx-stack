// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Button } from '../../components/Button.js';
import { Play, X, Zap } from '../../components/Icon.js';

interface BenchRunNoticeHealth {
  hasKey?: boolean;
  imageGenerationReady?: boolean;
  modelName?: string;
  ok: boolean;
}

type BenchRunNoticeHealthError =
  | { kind: 'raw'; message: string }
  | { kind: 'status'; status: number };

function getApiKeyLabel(
  health: BenchRunNoticeHealth | null,
  error: BenchRunNoticeHealthError | null,
): string {
  if (health) return health.hasKey ? 'Configured' : 'Not configured';
  return error ? 'Unknown' : 'Checking…';
}

function getImageGenerationLabel(
  health: BenchRunNoticeHealth | null,
): string {
  if (!health) return 'Checking…';
  return health.imageGenerationReady ? 'Configured' : 'Not configured';
}

export function BenchRunNotice(props: {
  blockers: readonly string[];
  health: BenchRunNoticeHealth | null;
  healthError: BenchRunNoticeHealthError | null;
  onClose: () => void;
  onGoToSettings: () => void;
  onRunWithDefaults: () => void;
  open: boolean;
}) {
  if (!props.open) return null;
  const hasBlockers = props.blockers.length > 0;
  const apiKeyLabel = getApiKeyLabel(props.health, props.healthError);
  const imageGenerationLabel = getImageGenerationLabel(props.health);
  const errorText = props.healthError?.kind === 'status'
    ? `Provider status check failed: ${props.healthError.status}`
    : props.healthError?.message;

  return (
    <div
      className='benchConfigOverlay'
      role='presentation'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <section
        className='benchConfigDialog benchRunNoticeDialog'
        role='alertdialog'
        aria-modal='true'
        aria-labelledby='bench-run-notice-title'
        aria-describedby='bench-run-notice-desc'
      >
        <header className='benchConfigHeader benchRunNoticeHeader'>
          <div className='benchRunNoticeLead'>
            <span className='benchRunNoticeIcon' aria-hidden='true'>
              <Zap size={17} strokeWidth={2} />
            </span>
            <div>
              <h2 id='bench-run-notice-title' className='benchConfigTitle'>
                {hasBlockers
                  ? 'Bench is not ready to run'
                  : 'Use the server defaults?'}
              </h2>
              <p id='bench-run-notice-desc' className='benchConfigSub'>
                {hasBlockers
                  ? 'Complete the required setup below first.'
                  : 'No custom Provider is configured.'}
              </p>
            </div>
          </div>
          <Button
            variant='ghost'
            size='md'
            iconOnly
            iconBefore={X}
            aria-label='Close notice'
            title='Close notice'
            onClick={props.onClose}
          />
        </header>

        <div className='benchRunNoticeBody'>
          {hasBlockers
            ? (
              <ul className='benchRunNoticeList'>
                {props.blockers.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            )
            : (
              <>
                <p className='benchRunNoticeText'>
                  This run will use the Provider configured on the server. The
                  browser will not send a Provider key, address, or default
                  Model.
                </p>
                <div className='benchRunHealthCard'>
                  <div>
                    <span>API key</span>
                    <strong>{apiKeyLabel}</strong>
                  </div>
                  <div>
                    <span>Model</span>
                    <strong>
                      {props.health?.modelName ?? 'Server default'}
                    </strong>
                  </div>
                  <div>
                    <span>Image generation</span>
                    <strong>{imageGenerationLabel}</strong>
                  </div>
                </div>
                {errorText
                  ? <p className='benchRunNoticeError'>{errorText}</p>
                  : null}
              </>
            )}
        </div>

        <footer className='benchConfigFooter'>
          <Button variant='secondary' size='md' onClick={props.onClose}>
            Close
          </Button>
          <Button
            variant={hasBlockers ? 'primary' : 'secondary'}
            size='md'
            iconBefore={Zap}
            onClick={props.onGoToSettings}
          >
            Go to settings
          </Button>
          {hasBlockers
            ? null
            : (
              <Button
                variant='primary'
                size='md'
                iconBefore={Play}
                disabled={props.health?.ok !== true}
                onClick={props.onRunWithDefaults}
              >
                Run with defaults
              </Button>
            )}
        </footer>
      </section>
    </div>
  );
}
