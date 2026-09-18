// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** The OpenAI SDK reads reasoning from summary, not plain-text content parts. */
export function normalizeReasoningItem(item: Record<string, unknown>): boolean {
  if (
    item.type !== 'reasoning' || !Array.isArray(item.content)
    || (item.summary !== undefined
      && (!Array.isArray(item.summary) || item.summary.length > 0))
    || item.content.length === 0
    || !item.content.every(part =>
      isRecord(part) && part.type === 'reasoning_text'
      && typeof part.text === 'string'
    )
  ) return false;
  item.summary = item.content.map(part => ({
    type: 'summary_text',
    text: (part as Record<string, unknown>).text,
  }));
  return true;
}

interface ReasoningPart {
  index: number;
  streamed: boolean;
  ended: boolean;
}

interface ReasoningItem {
  family: 'text' | 'summary';
  parts: Map<number, ReasoningPart>;
}

/** Adapt provider-returned text only; never request or reconstruct hidden reasoning. */
export function createResponsesReasoningStream(): TransformStream<
  string,
  string
> {
  const items = new Map<string, ReasoningItem>();
  let buffer = '';
  let frame = '';
  let lines: string[] = [];

  const normalizeEvent = (
    value: unknown,
  ): Record<string, unknown>[] | undefined => {
    if (!isRecord(value) || typeof value.item_id !== 'string') return;
    const type = value.type;
    const summary = typeof type === 'string'
      && type.startsWith('response.reasoning_summary_');
    const partEvent = type === 'response.content_part.added'
      || type === 'response.content_part.done';
    const part = isRecord(value.part) ? value.part : undefined;
    const raw = type === 'response.reasoning_text.delta'
      || type === 'response.reasoning_text.done'
      || (partEvent && part?.type === 'reasoning_text');
    if (!summary && !raw) return;
    const index = value.content_index;
    if (
      raw && (typeof index !== 'number' || !Number.isSafeInteger(index)
        || index < 0
        || (type === 'response.reasoning_text.delta'
          && typeof value.delta !== 'string'))
    ) return;

    const family = raw ? 'text' : 'summary';
    let item = items.get(value.item_id);
    if (!item) {
      item = { family, parts: new Map() };
      items.set(value.item_id, item);
    }
    // Some gateways send both representations for one item. Forward only one.
    if (item.family !== family) return [];
    if (summary) return;

    let state = item.parts.get(index as number);
    const events: Record<string, unknown>[] = [];
    const event = (type: string, fields: Record<string, unknown> = {}) => ({
      ...value,
      type,
      summary_index: state!.index,
      ...fields,
    });
    if (!state) {
      // Content indices need not start at zero; the SDK starts reasoning part 0.
      state = { index: item.parts.size, streamed: false, ended: false };
      item.parts.set(index as number, state);
      events.push(event('response.reasoning_summary_part.added', {
        part: { type: 'summary_text', text: '' },
      }));
    }
    if (state.ended) return [];
    if (type === 'response.reasoning_text.delta') {
      state.streamed ||= (value.delta as string).length > 0;
      events.push(event('response.reasoning_summary_text.delta'));
    } else if (
      type === 'response.reasoning_text.done'
      || type === 'response.content_part.done'
    ) {
      const text = partEvent ? part?.text : value.text;
      // A done event repeats the full text; use it only if no delta arrived.
      if (!state.streamed && typeof text === 'string' && text.length > 0) {
        events.push(
          event('response.reasoning_summary_text.delta', { delta: text }),
        );
      }
      state.ended = true;
      events.push(event('response.reasoning_summary_part.done', {
        part: {
          type: 'summary_text',
          text: typeof text === 'string' ? text : '',
        },
      }));
    }
    return events;
  };

  const normalizeFrame = () => {
    // The SDK parser can leave a final bare CR pending; complete frames use LF.
    const original = frame.replace(/\r\n|\r/gu, '\n');
    const data = lines.filter(line =>
      line === 'data' || line.startsWith('data:')
    )
      .map(line => line.slice(5).replace(/^ /u, '')).join('\n');
    let value: unknown;
    try {
      value = JSON.parse(data);
    } catch {
      // Comments, [DONE], and malformed events retain the original SDK behavior.
      return original;
    }
    const events = normalizeEvent(value);
    if (events === undefined) return original;
    const fields = lines.filter(line =>
      line !== 'data' && !line.startsWith('data:')
      && line !== 'event' && !line.startsWith('event:')
    );
    return events.map(event =>
      [
        ...fields,
        `event: ${String(event.type)}`,
        `data: ${JSON.stringify(event)}`,
        '',
        '',
      ]
        .join('\n')
    ).join('');
  };

  const drain = (
    controller: TransformStreamDefaultController<string>,
    eof = false,
  ) => {
    // Keep only the current SSE frame, handling CR/LF and UTF-8 chunk boundaries.
    const endings = /\r\n|[\r\n]/gu;
    let start = 0;
    for (
      let match = endings.exec(buffer);
      match;
      match = endings.exec(buffer)
    ) {
      if (
        !eof && match[0] === '\r' && endings.lastIndex === buffer.length
      ) break;
      const line = buffer.slice(start, match.index);
      frame += buffer.slice(start, endings.lastIndex);
      start = endings.lastIndex;
      if (line.length > 0) lines.push(line);
      else {
        const normalized = normalizeFrame();
        if (normalized) controller.enqueue(normalized);
        frame = '';
        lines = [];
      }
    }
    buffer = buffer.slice(start);
  };

  return new TransformStream({
    transform(chunk, controller) {
      buffer += chunk;
      drain(controller);
    },
    flush(controller) {
      drain(controller, true);
      // Do not turn an unterminated/truncated event into a complete event.
      if (frame || buffer) controller.enqueue(frame + buffer);
    },
  });
}
