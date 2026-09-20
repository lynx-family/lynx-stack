// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

type Dictionary = Record<string, string>;

const FENCE = /^(?:```|~~~)/;

/** The target of a Markdown link, which a localized page spells its own way. */
const TARGET = /(\]\()([^)\s]*)(\))/g;

/** The text a dictionary entry is keyed by: the prose without its links. */
function key(text: string): string {
  return text.replace(TARGET, '$1$3');
}

/** Puts the links of the page back into the translation, in their order. */
function withTargets(value: string, source: string): string {
  const targets = [...source.matchAll(TARGET)].map(match => match[2]);
  let index = 0;
  return value.replace(
    TARGET,
    (match, open: string, _: string, close: string) =>
      index < targets.length ? `${open}${targets[index++]}${close}` : match,
  );
}

/** The line TypeDoc writes for the source of a reflection. */
const SOURCE = 'Defined in: ';

function hasProse(text: string): boolean {
  if (text.startsWith(SOURCE)) return false;
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
  missing?: Set<string>,
): string {
  const source = text.trim();
  if (!hasProse(source)) return text;
  const entry = key(source);
  if (!dictionary) {
    used.add(entry);
    return text;
  }
  const value = dictionary[entry];
  if (!value) {
    // The entry is kept in the dictionary, empty, so the string a locale needs
    // survives `save()` and the build that follows reports it as missing.
    used.add(entry);
    missing?.add(entry);
    return text;
  }
  return text.replace(source, withTargets(value, source));
}

function translateRow(
  row: string,
  dictionary: Dictionary | undefined,
  used: Set<string>,
  missing?: Set<string>,
): string {
  const cells = row.split(/(?<!\\)\|/);
  return cells.map((cell, i) =>
    i === 0 || i === cells.length - 1 || /^\s*`/.test(cell)
      ? cell
      : translateText(cell, dictionary, used, missing)
  ).join('|');
}

/**
 * Translates the prose of a generated page. Every paragraph and table cell
 * with prose outside inline code is a string in `i18n/zh.json`; code blocks,
 * headings and table headers are left to TypeDoc's own `lang` option.
 */
function translate(
  markdown: string,
  dictionary: Dictionary | undefined,
  used: Set<string>,
  missing?: Set<string>,
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
          i < 2 ? row : translateRow(row, dictionary, used, missing)
        ).join('\n'),
      );
    } else if (/^#{1,6} /.test(text)) {
      out.push(text);
    } else {
      out.push(translateText(text, dictionary, used, missing));
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
  readonly #missing = new Set<string>();

  constructor(file: string) {
    this.#file = file;
    this.#dictionary = existsSync(file)
      ? JSON.parse(readFileSync(file, 'utf8')) as Dictionary
      : {};
  }

  translate(markdown: string, locale: string): string {
    const text = markdown.replaceAll('\r\n', '\n');
    return locale === 'en'
      ? translate(text, undefined, this.#used)
      : translate(text, this.#dictionary, this.#used, this.#missing);
  }

  /** The strings of a localized page that the dictionary does not translate. */
  get missing(): string[] {
    return [...this.#missing].sort();
  }

  save(): void {
    // A translated string is kept even when this run did not render it: which
    // options a section renders depends on what the workspace has built, and a
    // dictionary that drops them would differ between two builds of the same
    // commit. An entry left untranslated is dropped, so it stops being listed.
    const entries = new Set([
      ...this.#used,
      ...Object.keys(this.#dictionary).filter(en => this.#dictionary[en]),
    ]);
    const next: Dictionary = {};
    for (const en of [...entries].sort()) {
      next[en] = this.#dictionary[en] ?? '';
    }
    writeFileSync(this.#file, `${JSON.stringify(next, null, 2)}\n`);
  }
}
