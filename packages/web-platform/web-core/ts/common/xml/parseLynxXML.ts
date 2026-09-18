// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * A zero-dependency parser for the single file Lynx XML markup format.
 *
 * It is written without `DOMParser` or any third party XML library so that it
 * can run inside a Web Worker.
 *
 * The grammar accepted here is intentionally tiny:
 *
 * ```xml
 * <!doctype lynx>
 * <lynx engine-version="4.2">
 * <style> ... </style>
 * <script thread="main"> ... </script>
 * <script thread="background"> ... </script>
 * </lynx>
 * ```
 */

/**
 * The structured error describing why a document could not be parsed.
 */
export interface LynxXMLParseError {
  /**
   * The offset inside the source where the failure was detected, counted in
   * JavaScript string indices, i.e. UTF-16 code units. Note that the reference
   * implementation counts UTF-8 bytes instead, so for documents containing
   * non-ASCII text before the failure the two numbers differ.
   */
  offset: number;
  /**
   * The human readable reason, without the offset prefix.
   */
  message: string;
  /**
   * The full message, formatted exactly like the reference implementation:
   * `invalid TemplateBundle XML at offset <offset>: <message>`.
   */
  formattedMessage: string;
}

/**
 * The result of a successful parse.
 */
export interface LynxXMLParseSuccess {
  success: true;
  /**
   * The content of the `<style>` section. `undefined` when the document has no
   * `<style>` section, which is legal.
   */
  style: string | undefined;
  /**
   * The content of the `<script thread="main">` section. Always present, a
   * document without it is rejected.
   */
  mainThreadScript: string;
  /**
   * The content of the `<script thread="background">` section. `undefined`
   * when the document has no background script section, which is legal.
   */
  backgroundThreadScript: string | undefined;
}

/**
 * The result of a failed parse.
 */
export interface LynxXMLParseFailure {
  success: false;
  error: LynxXMLParseError;
}

/**
 * The discriminated union returned by {@link parseLynxXML}. Errors are returned
 * instead of thrown so that callers can forward them as `error` events.
 */
export type LynxXMLParseResult = LynxXMLParseSuccess | LynxXMLParseFailure;

const commentStart = '<!--';
const commentEnd = '-->';
const cdataStart = '<![CDATA[';
const lynxDoctype = '<!doctype lynx>';
const lynxRootClosingTag = '</lynx>';
const utf8ByteOrderMark = '\uFEFF';

/**
 * The whitespace set of the reference implementation. Note that this is narrower than
 * what `String.prototype.trim` considers whitespace, therefore all trimming in
 * this module goes through {@link trimASCIIWhitespace}.
 */
function isASCIIWhitespace(value: string): boolean {
  return value === ' ' || value === '\t' || value === '\n' || value === '\r'
    || value === '\f';
}

function trimASCIIWhitespace(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && isASCIIWhitespace(value[start]!)) {
    start++;
  }
  while (end > start && isASCIIWhitespace(value[end - 1]!)) {
    end--;
  }
  return value.slice(start, end);
}

function isOpeningTag(
  source: string,
  position: number,
  tagName: string,
): boolean {
  if (
    position >= source.length || source[position] !== '<'
    || !source.startsWith(tagName, position + 1)
  ) {
    return false;
  }
  const boundary = position + tagName.length + 1;
  return boundary < source.length
    && (source[boundary] === '>' || isASCIIWhitespace(source[boundary]!));
}

/**
 * Matches exactly one quoted attribute, optionally with a specific value.
 */
function isQuotedAttribute(
  attributes: string,
  attributeName: string,
  expectedValue?: string,
): boolean {
  if (attributes.length === 0) {
    return false;
  }
  if (!attributes.startsWith(attributeName)) {
    return false;
  }
  let rest = trimASCIIWhitespace(attributes.slice(attributeName.length));
  if (rest.length === 0 || rest[0] !== '=') {
    return false;
  }
  rest = trimASCIIWhitespace(rest.slice(1));
  const quote = rest[0];
  if (rest.length < 3 || (quote !== '"' && quote !== '\'')) {
    return false;
  }
  const closingQuote = rest.indexOf(quote, 1);
  if (closingQuote !== rest.length - 1 || closingQuote <= 1) {
    return false;
  }
  return expectedValue === undefined
    || rest.slice(1, closingQuote) === expectedValue;
}

function isEngineVersionAttribute(attributes: string): boolean {
  return isQuotedAttribute(attributes, 'engine-version');
}

function isThreadAttribute(
  attributes: string,
  thread: 'main' | 'background',
): boolean {
  return isQuotedAttribute(attributes, 'thread', thread);
}

interface SectionSlot {
  assign: (content: string) => void;
  isSeen: () => boolean;
}

class LynxXMLParser {
  #source: string;
  #position = 0;
  #style: string | undefined;
  #mainThreadScript: string | undefined;
  #backgroundThreadScript: string | undefined;
  #rootClosed = false;
  #error: LynxXMLParseError | undefined;

  constructor(source: string) {
    this.#source = source;
  }

  parse(): LynxXMLParseResult {
    const source = this.#source;
    if (source.startsWith(utf8ByteOrderMark)) {
      this.#position += utf8ByteOrderMark.length;
    }
    if (!this.#consumeIgnorable()) {
      return this.#result();
    }
    if (source.startsWith('<!', this.#position)) {
      if (!this.#consumeDoctype()) {
        return this.#result();
      }
      if (!this.#consumeIgnorable()) {
        return this.#result();
      }
    }
    if (!isOpeningTag(source, this.#position, 'lynx')) {
      this.#fail(
        this.#position,
        'expected \'<lynx engine-version="...">\' root element',
      );
      return this.#result();
    }
    if (!this.#consumeRootStart()) {
      return this.#result();
    }

    for (;;) {
      if (!this.#consumeIgnorable()) {
        return this.#result();
      }
      if (source.startsWith(lynxRootClosingTag, this.#position)) {
        this.#position += lynxRootClosingTag.length;
        this.#rootClosed = true;
        break;
      }
      if (this.#position === source.length) {
        break;
      }
      if (!this.#consumeSection()) {
        return this.#result();
      }
    }

    if (!this.#rootClosed) {
      this.#fail(this.#position, 'missing closing tag \'</lynx>\'');
      return this.#result();
    }
    if (!this.#consumeIgnorable()) {
      return this.#result();
    }
    if (this.#position !== source.length) {
      this.#fail(this.#position, 'unexpected content after \'</lynx>\'');
      return this.#result();
    }
    if (this.#mainThreadScript === undefined) {
      this.#fail(
        this.#position,
        'missing \'<script thread="main">\' section',
      );
      return this.#result();
    }
    return {
      success: true,
      style: this.#style,
      mainThreadScript: this.#mainThreadScript,
      backgroundThreadScript: this.#backgroundThreadScript,
    };
  }

  /**
   * Skips ASCII whitespace and comments. Comments may appear anywhere an
   * ignorable token is allowed.
   */
  #consumeIgnorable(): boolean {
    const source = this.#source;
    for (;;) {
      while (
        this.#position < source.length
        && isASCIIWhitespace(source[this.#position]!)
      ) {
        this.#position++;
      }
      if (!source.startsWith(commentStart, this.#position)) {
        return true;
      }
      const foundCommentEnd = source.indexOf(
        commentEnd,
        this.#position + commentStart.length,
      );
      if (foundCommentEnd === -1) {
        return this.#fail(this.#position, 'unterminated comment');
      }
      this.#position = foundCommentEnd + commentEnd.length;
    }
  }

  #consumeDoctype(): boolean {
    const source = this.#source;
    if (!source.startsWith(lynxDoctype, this.#position)) {
      return this.#fail(this.#position, 'expected \'<!doctype lynx>\'');
    }
    this.#position += lynxDoctype.length;
    return true;
  }

  #consumeRootStart(): boolean {
    const source = this.#source;
    const openingTagEnd = source.indexOf('>', this.#position + 1);
    if (openingTagEnd === -1) {
      return this.#fail(this.#position, 'unterminated \'<lynx>\' opening tag');
    }
    const openingTag = trimASCIIWhitespace(
      source.slice(this.#position + 1, openingTagEnd),
    );
    const tagNameEnd = openingTag.search(/[\t\n\f\r ]/u);
    const attributes = tagNameEnd === -1
      ? ''
      : trimASCIIWhitespace(openingTag.slice(tagNameEnd));
    if (!isEngineVersionAttribute(attributes)) {
      return this.#fail(
        this.#position,
        '\'<lynx>\' requires exactly one non-empty \'engine-version\' attribute',
      );
    }
    this.#position = openingTagEnd + 1;
    return true;
  }

  #assignSectionContent(
    slot: SectionSlot,
    content: string,
    contentStart: number,
  ): boolean {
    if (trimASCIIWhitespace(content).startsWith(cdataStart)) {
      return this.#fail(contentStart, 'CDATA sections are not supported');
    }
    slot.assign(content);
    return true;
  }

  #consumeSection(): boolean {
    const source = this.#source;
    const sectionStart = this.#position;
    if (source[this.#position] !== '<') {
      return this.#fail(this.#position, 'unexpected content outside a section');
    }
    const openingTagEnd = source.indexOf('>', this.#position + 1);
    if (openingTagEnd === -1) {
      return this.#fail(this.#position, 'unterminated opening tag');
    }
    const openingTag = trimASCIIWhitespace(
      source.slice(this.#position + 1, openingTagEnd),
    );
    if (openingTag.length === 0 || openingTag[0] === '/') {
      return this.#fail(this.#position, 'unexpected closing tag');
    }
    const tagNameEnd = openingTag.search(/[\t\n\f\r ]/u);
    const tagName = tagNameEnd === -1
      ? openingTag
      : openingTag.slice(0, tagNameEnd);
    const attributes = tagNameEnd === -1
      ? ''
      : trimASCIIWhitespace(openingTag.slice(tagNameEnd));

    let closingTag: string;
    let slot: SectionSlot;
    if (tagName === 'style') {
      if (attributes.length !== 0) {
        return this.#fail(
          sectionStart,
          '\'<style>\' does not accept attributes',
        );
      }
      closingTag = '</style>';
      slot = {
        assign: (content) => {
          this.#style = content;
        },
        isSeen: () => this.#style !== undefined,
      };
    } else if (tagName === 'script') {
      closingTag = '</script>';
      if (isThreadAttribute(attributes, 'main')) {
        slot = {
          assign: (content) => {
            this.#mainThreadScript = content;
          },
          isSeen: () => this.#mainThreadScript !== undefined,
        };
      } else if (isThreadAttribute(attributes, 'background')) {
        slot = {
          assign: (content) => {
            this.#backgroundThreadScript = content;
          },
          isSeen: () => this.#backgroundThreadScript !== undefined,
        };
      } else {
        return this.#fail(
          sectionStart,
          '\'<script>\' requires exactly one \'thread="main"\' or \'thread="background"\' attribute',
        );
      }
    } else {
      return this.#fail(
        sectionStart,
        `unsupported top-level tag '<${tagName}>'`,
      );
    }

    if (slot.isSeen()) {
      return this.#fail(sectionStart, `duplicate '<${openingTag}>' section`);
    }

    const contentStart = openingTagEnd + 1;
    const closingTagStart = source.indexOf(closingTag, contentStart);
    if (closingTagStart === -1) {
      return this.#fail(contentStart, `missing closing tag '${closingTag}'`);
    }
    if (
      !this.#assignSectionContent(
        slot,
        source.slice(contentStart, closingTagStart),
        contentStart,
      )
    ) {
      return false;
    }
    this.#position = closingTagStart + closingTag.length;
    return true;
  }

  #fail(offset: number, message: string): false {
    this.#error = {
      offset,
      message,
      formattedMessage:
        `invalid TemplateBundle XML at offset ${offset}: ${message}`,
    };
    return false;
  }

  #result(): LynxXMLParseFailure {
    return {
      success: false,
      error: this.#error ?? {
        offset: this.#position,
        message: 'unknown error',
        formattedMessage:
          `invalid TemplateBundle XML at offset ${this.#position}: unknown error`,
      },
    };
  }
}

/**
 * Parses a single file Lynx XML markup document into its three source sections.
 *
 * This never throws for malformed input: inspect the `success` discriminant of
 * the returned {@link LynxXMLParseResult} instead.
 *
 * @param source - The whole XML document. A leading UTF-8 BOM is tolerated.
 */
export function parseLynxXML(source: string): LynxXMLParseResult {
  return new LynxXMLParser(source).parse();
}
