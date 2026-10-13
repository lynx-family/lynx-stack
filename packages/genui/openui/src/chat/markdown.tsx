// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Lexer } from 'marked';
import type { Token, Tokens } from 'marked';

import { useMemo } from '@lynx-js/react';
import type { ReactNode } from '@lynx-js/react';

import { Citation, useOpenLink } from './sources.jsx';
import '../../styles/catalog/ChatMarkdown.css';

function decoded(text: string): string {
  return text.replace(
    /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (entity, name: string) => {
      const named: Record<string, string> = {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: '\'',
      };
      if (!name.startsWith('#')) return named[name.toLowerCase()] ?? entity;
      const point = name[1]?.toLowerCase() === 'x'
        ? Number.parseInt(name.slice(2), 16)
        : Number(name.slice(1));
      return point > 0 && point <= 0x10FFFF
        ? String.fromCodePoint(point)
        : entity;
    },
  );
}

function Inline({ tokens }: { tokens: Token[] }) {
  const open = useOpenLink();
  return (
    <>
      {tokens.map((token, index): ReactNode => {
        switch (token.type) {
          case 'strong':
          case 'em':
          case 'del':
            return (
              <text key={index} className={`OpenUIChatMarkdown-${token.type}`}>
                <Inline tokens={(token as Tokens.Strong).tokens} />
              </text>
            );
          case 'link': {
            const link = token as Tokens.Link;
            return (
              <text
                key={index}
                className='OpenUIChatLink'
                bindtap={() => open(link.text, link.href)}
              >
                <Inline tokens={link.tokens} />
              </text>
            );
          }
          case 'br':
            return '\n';
          case 'codespan':
            return (
              <text key={index} className='OpenUIChatCode'>
                {decoded((token as Tokens.Codespan).text)}
              </text>
            );
          case 'image':
            return (
              <text
                key={index}
                className='OpenUIChatLink'
                bindtap={() =>
                  open(
                    (token as Tokens.Image).text,
                    (token as Tokens.Image).href,
                  )}
              >
                {(token as Tokens.Image).text || 'Image'}
              </text>
            );
          default: {
            const text = decoded(
              'text' in token ? String(token.text) : token.raw,
            );
            return (
              <text key={index}>
                {text.split(/(\[\d+\])/).map((part, i) =>
                  /^\[\d+\]$/.test(part)
                    ? <Citation key={i} index={Number(part.slice(1, -1))} />
                    : part
                )}
              </text>
            );
          }
        }
      })}
    </>
  );
}

function Blocks({ tokens }: { tokens: Token[] }) {
  return (
    <>
      {tokens.map((token, index): ReactNode => {
        switch (token.type) {
          case 'space':
            return null;
          case 'hr':
            return <view key={index} className='OpenUIChatMarkdownRule' />;
          case 'heading': {
            const heading = token as Tokens.Heading;
            return (
              <text
                key={index}
                className={`OpenUIChatMarkdownText OpenUIChatHeading OpenUIChatHeading-${heading.depth}`}
              >
                <Inline tokens={heading.tokens} />
              </text>
            );
          }
          case 'blockquote':
            return (
              <view key={index} className='OpenUIChatQuote'>
                <Blocks tokens={(token as Tokens.Blockquote).tokens} />
              </view>
            );
          case 'code':
            return (
              <view key={index} className='OpenUIChatCodeBlock'>
                <text className='OpenUIChatMarkdownText OpenUIChatCode'>
                  {(token as Tokens.Code).text}
                </text>
              </view>
            );
          case 'list': {
            const list = token as Tokens.List;
            return (
              <view key={index} className='OpenUIChatMarkdownList'>
                {list.items.map((item, i) => (
                  <view key={i} className='OpenUIChatMarkdownListRow'>
                    <text className='OpenUIChatMarkdownText OpenUIChatMarker'>
                      {item.task
                        ? (item.checked ? '☑' : '☐')
                        : (list.ordered
                          ? `${Number(list.start) + i}.`
                          : '•')}
                    </text>
                    <view className='OpenUIChatMarkdownListBody'>
                      <Blocks tokens={item.tokens} />
                    </view>
                  </view>
                ))}
              </view>
            );
          }
          case 'table': {
            const table = token as Tokens.Table;
            return (
              <scroll-view
                key={index}
                scroll-orientation='horizontal'
                className='OpenUIChatMarkdownTable'
              >
                {[table.header, ...table.rows].map((row, i) => (
                  <view key={i} className='OpenUIChatMarkdownTableRow'>
                    {row.map((cell, j) => (
                      <view key={j} className='OpenUIChatMarkdownCell'>
                        <text
                          className={`OpenUIChatMarkdownText ${
                            i === 0 ? 'OpenUIChatMarkdown-strong' : ''
                          }`}
                        >
                          <Inline tokens={cell.tokens} />
                        </text>
                      </view>
                    ))}
                  </view>
                ))}
              </scroll-view>
            );
          }
          default: {
            const block = token as Tokens.Paragraph;
            return (
              <text key={index} className='OpenUIChatMarkdownText'>
                {block.tokens
                  ? <Inline tokens={block.tokens} />
                  : decoded('text' in token ? String(token.text) : token.raw)}
              </text>
            );
          }
        }
      })}
    </>
  );
}

export function Markdown(
  { text, size = 'default' }: { text: string; size?: string },
) {
  const tokens = useMemo<Token[]>(() => {
    // Marked uses Unicode property escapes unsupported by the native main-thread
    // VM. Initial rendering keeps the text; background hydration adds Markdown.
    if (__BACKGROUND__) return Lexer.lex(text, { gfm: true });
    return [{ type: 'paragraph', raw: text, text }];
  }, [text]);
  return (
    <view className={`OpenUIChatMarkdown OpenUIChatMarkdown-${size}`}>
      <Blocks tokens={tokens} />
    </view>
  );
}
