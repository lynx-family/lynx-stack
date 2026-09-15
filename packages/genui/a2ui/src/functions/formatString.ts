// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { FunctionCallContext } from '../store/FunctionRegistry.js';

/** Parse interpolation into v1.0 bindings and calls, including system functions. */
export function formatString(
  template: string,
  context?: FunctionCallContext,
): string {
  const parser = new InterpolationParser(template);
  return parser.parse().map(part => {
    const value = part !== null && typeof part === 'object'
      ? context?.resolveDynamicValue(part)
      : part;
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    if (
      typeof value === 'string' || typeof value === 'number'
      || typeof value === 'boolean'
    ) return String(value);
    return '';
  }).join('');
}

class InterpolationParser {
  private position = 0;
  constructor(private readonly input: string) {}

  parse(): unknown[] {
    const parts: unknown[] = [];
    let literal = '';
    while (this.position < this.input.length) {
      if (this.input.startsWith('\\${', this.position)) {
        literal += '${';
        this.position += 3;
      } else if (this.input.startsWith('${', this.position)) {
        parts.push(literal);
        literal = '';
        this.position += 2;
        parts.push(this.value(0));
        this.consume('}');
      } else {
        literal += this.input[this.position++];
      }
    }
    parts.push(literal);
    return parts;
  }

  private whitespace(): void {
    while (/\s/.test(this.input[this.position] ?? '')) this.position++;
  }

  private consume(token: string): void {
    this.whitespace();
    if (!this.input.startsWith(token, this.position)) {
      throw new Error(`Expected "${token}" at position ${this.position}`);
    }
    this.position += token.length;
  }

  private value(depth: number): unknown {
    if (depth > 10) throw new Error('Maximum interpolation depth exceeded');
    this.whitespace();
    if (this.input.startsWith('${', this.position)) {
      this.position += 2;
      const value = this.value(depth + 1);
      this.consume('}');
      return value;
    }
    const quote = this.input[this.position];
    if (quote === '"' || quote === '\'') {
      this.position++;
      let value = '';
      while (this.position < this.input.length) {
        const char = this.input[this.position++];
        if (char === quote) return value;
        if (char === '\\') {
          const escaped = this.input[this.position++];
          if (escaped === undefined) break;
          value += escaped === 'n' ? '\n' : (escaped === 't' ? '\t' : escaped);
        } else value += char;
      }
      throw new Error('Unclosed interpolation string');
    }
    const token = (/^[^\s():,{}'"\\]+/.exec(this.input.slice(this.position)))
      ?.[0];
    if (!token) {
      throw new Error(`Expected expression at position ${this.position}`);
    }
    this.position += token.length;
    this.whitespace();
    if (this.input[this.position] === '(') {
      this.position++;
      const args: Record<string, unknown> = {};
      this.whitespace();
      while (this.input[this.position] !== ')') {
        const name = (/^[^\s():,{}'"\\]+/.exec(this.input.slice(this.position)))
          ?.[0];
        if (!name) {
          throw new Error(`Expected argument at position ${this.position}`);
        }
        this.position += name.length;
        this.consume(':');
        Object.defineProperty(args, name, {
          value: this.value(depth + 1),
          enumerable: true,
        });
        this.whitespace();
        if (this.input[this.position] !== ',') break;
        this.position++;
        this.whitespace();
      }
      this.consume(')');
      return { call: token, args };
    }
    if (token === 'true') return true;
    if (token === 'false') return false;
    if (token === 'null') return null;
    if (/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(token)) return Number(token);
    return { path: token };
  }
}
