// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export type Dictionary = Record<string, string>;

const FENCE = /^(?:```|~~~)/;

function hasProse(text: string): boolean {
  return /\p{L}{2,}[\s,]+\p{L}{2,}/u.test(
    text
      .replace(/`[^`\n]*`/g, '')
      .replace(/\[[^\]]*\]\([^)\s]*\)/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/<[^>]+>/g, ''),
  );
}

function translateText(
  text: string,
  dictionary: Dictionary | undefined,
  used: Set<string>,
): string {
  const key = text.trim();
  if (!hasProse(key)) return text;
  if (!dictionary) {
    used.add(key);
    return text;
  }
  const value = dictionary[key];
  return value ? text.replace(key, value) : text;
}

function translateRow(
  row: string,
  dictionary: Dictionary | undefined,
  used: Set<string>,
): string {
  const cells = row.split(/(?<!\\)\|/);
  return cells.map((cell, i) =>
    i === 0 || i === cells.length - 1 || /^\s*`/.test(cell)
      ? cell
      : translateText(cell, dictionary, used)
  ).join('|');
}

/**
 * Translates the prose of a generated page. Every paragraph and table cell
 * with prose outside inline code is a string in `i18n/zh.json`; code blocks,
 * headings and table headers are left to TypeDoc's own `lang` option.
 */
export function translate(
  markdown: string,
  dictionary: Dictionary | undefined,
  used: Set<string>,
): string {
  const out: string[] = [];
  let block: string[] = [];
  let fence = false;
  const flush = () => {
    if (block.length === 0) return;
    const text = block.join('\n');
    block = [];
    if (/^\s*\|/.test(text)) {
      out.push(
        text.split('\n').map((row, i) =>
          i < 2 ? row : translateRow(row, dictionary, used)
        ).join('\n'),
      );
    } else if (/^#{1,6} /.test(text) || /^\*\*\*$/.test(text)) {
      out.push(text);
    } else {
      out.push(translateText(text, dictionary, used));
    }
  };
  for (const line of markdown.split('\n')) {
    if (FENCE.test(line)) {
      if (!fence) flush();
      fence = !fence;
      out.push(line);
      continue;
    }
    if (fence) {
      out.push(line);
    } else if (line.trim() === '') {
      flush();
      out.push(line);
    } else {
      block.push(line);
    }
  }
  flush();
  return out.join('\n');
}

/**
 * The Chinese dictionary in `i18n/zh.json`. English pages record the strings
 * they contain; Chinese pages look them up; {@link Translations.save} writes
 * back only the strings that are still used.
 */
export class Translations {
  readonly #file: string;
  readonly #dictionary: Dictionary;
  readonly #used = new Set<string>();

  constructor(file: string) {
    this.#file = file;
    this.#dictionary = existsSync(file)
      ? JSON.parse(readFileSync(file, 'utf8')) as Dictionary
      : {};
  }

  translate(markdown: string, locale: string): string {
    return translate(
      markdown.replaceAll('\r\n', '\n'),
      locale === 'zh' ? this.#dictionary : undefined,
      this.#used,
    );
  }

  save(): void {
    const next: Dictionary = {};
    for (const en of [...this.#used].sort()) {
      next[en] = this.#dictionary[en] ?? '';
    }
    writeFileSync(this.#file, `${JSON.stringify(next, null, 2)}\n`);
  }
}
