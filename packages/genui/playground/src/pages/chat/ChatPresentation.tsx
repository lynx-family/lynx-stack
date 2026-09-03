// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useEffect, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

import { Button } from '../../components/Button.js';
import { Send, Sparkles, TriangleAlert, Zap } from '../../components/Icon.js';
import type {
  ChatArtifact,
  ChatMessageIcon,
  ChatMessageModel,
  ChatSettingControl,
} from '../../shared-ui/types.js';
import type { PreviewPerformanceMetrics } from '../../utils/previewTypes.js';

function safeStringifyPayload(value: unknown): string {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function payloadToChunks(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [value];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [value];
  }
}

function JsonPayloadViewer(props: {
  payload: unknown;
  layout?: 'single' | 'chunks';
  onCopy: (text: string) => void;
}) {
  const { layout = 'chunks', onCopy, payload } = props;
  if (layout === 'single') {
    const text = safeStringifyPayload(payload);
    return (
      <div className='chatMessagePayload'>
        <div className='chatMessageSingleChunk'>
          <div className='chatMessageChunkHeader'>
            <span className='chatMessageChunkIndex'>Request</span>
            <button
              type='button'
              className='chatJsonCopyButton'
              onClick={() => onCopy(text)}
            >
              Copy
            </button>
          </div>
          <pre className='chatMessageChunkJson'>{text}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className='chatMessagePayload'>
      <div className='chatMessageChunks'>
        {payloadToChunks(payload).map((chunk, index) => {
          const text = safeStringifyPayload(chunk);
          return (
            <div className='chatMessageChunk' key={index}>
              <div className='chatMessageChunkHeader'>
                <span className='chatMessageChunkIndex'>#{index + 1}</span>
                <button
                  type='button'
                  className='chatJsonCopyButton'
                  onClick={() => onCopy(text)}
                >
                  Copy
                </button>
              </div>
              <pre className='chatMessageChunkJson'>{text}</pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MessageStatusIcon(props: { icon: ChatMessageIcon | undefined }) {
  switch (props.icon) {
    case 'spinner':
      return <span className='chatMessageActionSpinner' aria-hidden='true' />;
    case 'sparkles':
      return (
        <span className='chatMessageStatusIcon' aria-hidden='true'>
          <Sparkles size={13} strokeWidth={2} />
        </span>
      );
    case 'zap':
      return (
        <span className='chatMessageStatusIcon' aria-hidden='true'>
          <Zap size={13} strokeWidth={2} />
        </span>
      );
    case 'error':
      return (
        <span className='chatMessageStatusIcon' aria-hidden='true'>
          !
        </span>
      );
    default:
      return null;
  }
}

function formatMetricValue(value: number | undefined): string {
  return typeof value === 'number' ? `${Math.round(value)}ms` : '...';
}

function MessageMetrics(props: { metrics: PreviewPerformanceMetrics }) {
  const items = [
    { key: 'fcpMs', label: 'FCP', value: props.metrics.fcpMs },
    { key: 'fmpMs', label: 'FMP', value: props.metrics.fmpMs },
    { key: 'ttiMs', label: 'TTI', value: props.metrics.ttiMs },
    {
      key: 'agentOutputMs',
      label: 'Agent',
      value: props.metrics.agentOutputMs,
    },
    { key: 'renderMs', label: 'Render', value: props.metrics.renderMs },
  ].filter((item) => typeof item.value === 'number');
  if (items.length === 0) return null;
  return (
    <div className='chatMessageMetrics' aria-label='Metrics'>
      {items.map((item) => (
        <span className='chatMessageMetricItem' key={item.key}>
          <span className='chatMessageMetricName'>{item.label}</span>
          <span className='chatMessageMetricValue'>
            {formatMetricValue(item.value)}
          </span>
        </span>
      ))}
    </div>
  );
}

export function ChatTranscript(props: {
  messages: readonly ChatMessageModel[];
  onCopy: (text: string) => void;
}) {
  const { messages, onCopy } = props;
  return (
    <>
      {messages.map((message, index) => {
        const roleClassName = (() => {
          if (message.kind === 'user') return 'chatMessageUser';
          if (message.kind === 'action') {
            return message.payload === undefined
              ? 'chatMessageAction'
              : 'chatMessageAction chatMessageActionExpanded';
          }
          if (message.kind === 'output') return 'chatMessageJson';
          if (message.kind === 'status') {
            return `chatMessageStatus chatMessageStatus-${
              message.tone ?? 'info'
            }`;
          }
          return 'chatMessageAI';
        })();
        const payloadText = message.payload === undefined
          ? ''
          : safeStringifyPayload(message.payload);
        return (
          <div
            className={`chatMessage ${roleClassName}${
              message.side === 'right' ? ' chatMessageRight' : ''
            }`}
            key={message.id ?? index}
          >
            <div className='chatMessageBody'>
              <MessageStatusIcon icon={message.icon} />
              <span>
                {message.text}
                {message.code
                  ? (
                    <>
                      {' '}
                      <code className='chatMessageStatusInline'>
                        {message.code}
                      </code>
                    </>
                  )
                  : null}
              </span>
              {message.payload === undefined
                ? null
                : (
                  <button
                    type='button'
                    className='chatJsonCopyButton'
                    onClick={() => onCopy(payloadText)}
                  >
                    Copy all
                  </button>
                )}
            </div>
            {message.payload === undefined
              ? null
              : (
                <JsonPayloadViewer
                  payload={message.payload}
                  {...(message.payloadLayout
                    ? { layout: message.payloadLayout }
                    : {})}
                  onCopy={onCopy}
                />
              )}
            {message.metrics
              ? <MessageMetrics metrics={message.metrics} />
              : null}
          </div>
        );
      })}
    </>
  );
}

export function ArtifactViewer(props: {
  artifact: ChatArtifact;
  onCopy: (text: string) => void;
}) {
  const { artifact, onCopy } = props;
  const [activeViewId, setActiveViewId] = useState(
    () => artifact.views[0]?.id ?? '',
  );
  const activeView = artifact.views.find((view) => view.id === activeViewId)
    ?? artifact.views[0];

  useEffect(() => {
    if (artifact.views.some((view) => view.id === activeViewId)) return;
    setActiveViewId(artifact.views[0]?.id ?? '');
  }, [activeViewId, artifact.views]);

  if (!activeView) return null;
  return (
    <div className='chatGeneratedJson chatArtifact'>
      <div className='chatGeneratedJsonTitle chatArtifactHeader'>
        <div className='chatArtifactTitle'>
          <span>{artifact.title}</span>
          {artifact.meta
            ? <span className='chatArtifactMeta'>{artifact.meta}</span>
            : null}
        </div>
        <div className='chatArtifactActions'>
          {artifact.views.length > 1
            ? (
              <div className='previewModeSwitch chatArtifactSwitch'>
                {artifact.views.map((view) => (
                  <button
                    key={view.id}
                    type='button'
                    className={view.id === activeView.id
                      ? 'previewModeBtn active'
                      : 'previewModeBtn'}
                    onClick={() => setActiveViewId(view.id)}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
            )
            : null}
          <button
            type='button'
            className='chatJsonCopyButton'
            onClick={() => onCopy(activeView.text)}
          >
            Copy
          </button>
        </div>
      </div>
      <pre className='chatMessageChunkJson chatArtifactCodeBlock'>
        {activeView.text}
      </pre>
    </div>
  );
}

export interface PromptComposerItem {
  id: string;
  label: string;
  title?: string;
  onSelect: () => void;
}

export interface PromptComposerProps {
  showStarterContent: boolean;
  suggestions: readonly PromptComposerItem[];
  examples: readonly PromptComposerItem[];
  promptHint: ReactNode;
  examplesHint: ReactNode;
  privacyNotice: ReactNode;
  inputId?: string;
  formId?: string;
  inputAriaLabel: string;
  inputPlaceholder: string;
  value: string;
  disabled: boolean;
  controls: readonly ChatSettingControl[];
  onValueChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onControlChange: (id: string, value: string) => void;
  onSubmit: () => void;
  submitLabel: string;
}

export function PromptComposer(props: PromptComposerProps) {
  const fieldControls = props.controls.filter((control) =>
    control.kind !== 'select'
  );
  const selectControls = props.controls.filter((control) =>
    control.kind === 'select'
  );
  return (
    <form
      id={props.formId}
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      {props.showStarterContent
        ? (
          <>
            <div className='promptSuggestions'>
              <div className='promptSuggestionsHeader'>
                <span className='promptSuggestionsLabel'>
                  <span
                    className='promptSuggestionsLabelDot'
                    aria-hidden='true'
                  />
                  Describe with a prompt
                  <span className='promptSuggestionsLabelHint'>
                    {props.promptHint}
                  </span>
                </span>
              </div>
              <div className='promptSuggestionsRail'>
                {props.suggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type='button'
                    className='chatSuggestionChip'
                    title={suggestion.title}
                    disabled={props.disabled}
                    onClick={suggestion.onSelect}
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </div>
            {props.examples.length > 0
              ? (
                <div className='promptSuggestions'>
                  <div className='promptSuggestionsHeader'>
                    <span className='promptSuggestionsLabel'>
                      <Zap size={13} strokeWidth={2} aria-hidden='true' />
                      Load a local example
                      <span className='promptSuggestionsLabelHint'>
                        {props.examplesHint}
                      </span>
                    </span>
                  </div>
                  <div className='promptSuggestionsRail'>
                    {props.examples.map((example) => (
                      <button
                        key={example.id}
                        type='button'
                        className='chatSuggestionChip'
                        title={example.title}
                        disabled={props.disabled}
                        onClick={example.onSelect}
                      >
                        {example.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
              : null}
          </>
        )
        : null}
      <aside className='chatPrivacyNotice' aria-label='Privacy notice'>
        <TriangleAlert
          className='chatPrivacyNoticeIcon'
          size={16}
          strokeWidth={2}
          aria-hidden='true'
        />
        <p className='chatPrivacyNoticeText'>{props.privacyNotice}</p>
      </aside>
      <div className='chatComposer'>
        <textarea
          id={props.inputId}
          className='chatInput'
          aria-label={props.inputAriaLabel}
          placeholder={props.inputPlaceholder}
          value={props.value}
          rows={3}
          disabled={props.disabled}
          onChange={(event) => props.onValueChange(event.target.value)}
          onKeyDown={props.onKeyDown}
        />
        {fieldControls.length > 0
          ? (
            <div className='chatProviderConfig'>
              {fieldControls.map((control) => (
                <input
                  key={control.id}
                  id={control.id}
                  className={control.id === 'baseURL'
                    ? 'chatProviderInputField chatProviderInputFieldUrl'
                    : 'chatProviderInputField'}
                  aria-label={control.label}
                  type={control.kind}
                  placeholder={control.placeholder}
                  value={control.value}
                  disabled={props.disabled || control.disabled}
                  onChange={(event) =>
                    props.onControlChange(control.id, event.target.value)}
                />
              ))}
            </div>
          )
          : null}
        <div className='chatComposerFooter'>
          <div className='chatProviderControl'>
            {selectControls.map((control) => (
              <span
                key={control.id}
                className={control.fadeOverflow
                  ? 'chatProviderSelectSlot chatProviderSelectFade'
                  : 'chatProviderSelectSlot'}
              >
                <select
                  id={control.id}
                  className='chatProviderSelect'
                  aria-label={control.label}
                  title={control.title}
                  value={control.value}
                  disabled={props.disabled || control.disabled}
                  onChange={(event) =>
                    props.onControlChange(control.id, event.target.value)}
                >
                  {control.options?.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </span>
            ))}
          </div>
          <Button
            type='submit'
            variant='primary'
            size='lg'
            iconBefore={Send}
            disabled={props.disabled || props.value.trim().length === 0}
          >
            {props.submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
