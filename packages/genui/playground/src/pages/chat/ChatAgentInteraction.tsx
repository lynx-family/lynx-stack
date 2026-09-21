// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ReactNode } from 'react';

import {
  chatInteractionLabel,
  serializeChatInteraction,
} from './chatInteraction.js';
import type { ChatInteractionLog, ChatMessageTone } from './type.js';
import { ChevronDown } from '../../components/Icon.js';

export function ChatAgentInteraction(props: {
  summary: ReactNode;
  children?: ReactNode;
  tone: ChatMessageTone | undefined;
  log: ChatInteractionLog;
  onCopy: (text: string) => void;
}) {
  const { children, log, onCopy, summary, tone } = props;
  // Match A2UI Create's card while generating or failing, and its compact
  // status row after completion, regardless of the protocol message kind.
  const messageClassName = tone === 'pending' || tone === 'error'
    ? 'chatMessageAI'
    : `chatMessageStatus chatMessageStatus-${tone ?? 'info'}`;
  const rawOutputSummary = log.rawOutput
    ? (
      <>
        <span>Raw output</span>
        <span>
          {log.rawOutput.count} {log.rawOutput.count === 1 ? 'chunk' : 'chunks'}
        </span>
        <span className='chatAgentInteractionTime'>
          +{(log.rawOutput.elapsedMs / 1000).toFixed(2)}s
        </span>
      </>
    )
    : null;
  return (
    <div
      className={`chatMessage ${messageClassName} chatMessageWithInteraction`}
    >
      <details className='chatAgentInteraction'>
        <summary className='chatMessageBody chatAgentInteractionSummary'>
          {summary}
          <ChevronDown
            className='chatAgentInteractionChevron'
            size={14}
            aria-hidden='true'
          />
        </summary>
        <div className='chatAgentInteractionDetails'>
          <div className='chatAgentInteractionHeader'>
            <span>
              Agent interaction
              {log.modelRequestCount === undefined
                ? ''
                : ` · ${log.modelRequestCount} model ${
                  log.modelRequestCount === 1 ? 'request' : 'requests'
                }`}
            </span>
            <button
              type='button'
              className='chatJsonCopyButton'
              onClick={() => onCopy(serializeChatInteraction(log))}
            >
              Copy details
            </button>
          </div>
          {tone === 'error' && log.reasoning
            ? (
              <details className='chatAgentReasoning'>
                <summary>Reasoning</summary>
                <pre>{log.reasoning.text}</pre>
                {log.reasoning.truncated
                  ? (
                    <p className='chatAgentInteractionNotice'>
                      Reasoning truncated.
                    </p>
                  )
                  : null}
              </details>
            )
            : null}
          {log.omittedEntries > 0
            ? (
              <p className='chatAgentInteractionNotice'>
                {log.omittedEntries} earlier events omitted.
              </p>
            )
            : null}
          <ol
            className='chatAgentInteractionEvents'
            aria-label='Agent interaction events'
          >
            {(() => {
              let seenModelStart = false;
              return log.entries.map((entry, index) => {
                // Divide consecutive model interactions, but not before the first.
                const separate = entry.modelStart && seenModelStart;
                if (entry.modelStart) seenModelStart = true;
                return (
                  <li
                    className={separate
                      ? 'chatAgentInteractionEvent chatAgentInteractionEventDivided'
                      : 'chatAgentInteractionEvent'}
                    key={index}
                  >
                    <div className='chatAgentInteractionEventHeader'>
                      <span>{chatInteractionLabel(entry.event)}</span>
                      {entry.count > 1
                        ? <span>{entry.count} chunks</span>
                        : null}
                      <span className='chatAgentInteractionTime'>
                        +{(entry.elapsedMs / 1000).toFixed(2)}s
                      </span>
                    </div>
                    {entry.detail ? <pre>{entry.detail}</pre> : null}
                    {entry.truncated
                      ? (
                        <p className='chatAgentInteractionNotice'>
                          Event details truncated.
                        </p>
                      )
                      : null}
                  </li>
                );
              });
            })()}
          </ol>
          {log.rawOutput
            ? (
              <div className='chatAgentInteractionRaw'>
                <div className='chatAgentInteractionRawSummary'>
                  {rawOutputSummary}
                </div>
                <p className='chatAgentInteractionNotice'>
                  View the full content in the generated output.
                </p>
              </div>
            )
            : null}
        </div>
      </details>
      {children}
    </div>
  );
}
