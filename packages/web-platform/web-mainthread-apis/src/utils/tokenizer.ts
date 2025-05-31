// @ts-ignore the wasm module built later than the ts code
import initWasm from '../../binary/tokenizer.js';
// @ts-ignore built later than the ts code
import { stringConsts } from '../../tmp/replace-rule-trie.js';

const tokenizerRef = {
  tokenizer: null as any as Awaited<ReturnType<typeof initWasm>>,
};

export const initTokenizer = async () => {
  const tokenizer = await initWasm();
  tokenizerRef.tokenizer = tokenizer;
};

export function transformInlineStyleString(
  source: string,
) {
  const tokenizer = tokenizerRef.tokenizer;
  const sourcePtr = tokenizer._malloc((source.length + 1) * 2);
  tokenizer.stringToUTF16(source, sourcePtr, (source.length + 1) * 2);
  let currentEnd = 0;
  const transformedStringArray: string[] = [];
  // @ts-expect-error
  globalThis._tokenizer_on_declaration_callback = (
    start: number,
    end: number,
    replaceId: number,
    semicolonEnd: number,
    isImportant: number,
  ) => {
    const replacement = stringConsts[replaceId]!;
    transformedStringArray.push(source.slice(currentEnd, start));
    if (!Array.isArray(replacement)) { // rename rule
      currentEnd = end;
      transformedStringArray.push(replacement);
    } else { // replace rule
      currentEnd = semicolonEnd;
      for (const [property, value] of replacement) {
        transformedStringArray.push(
          `${property}:${value}${isImportant ? '!important' : ''};`,
        );
      }
    }
  };
  tokenizer._tokenize(sourcePtr, source.length);
  // @ts-expect-error
  globalThis._tokenizer_on_token_callback = null;
  tokenizer._free(sourcePtr);
  if (currentEnd === 0) {
    return source;
  } else {
    transformedStringArray.push(source.slice(currentEnd));
    return transformedStringArray.join('');
  }
}

export const EOF = 0; // <EOF-token>
export const Ident = 1; // <ident-token>
export const Function = 2; // <function-token>
export const AtKeyword = 3; // <at-keyword-token>
export const Hash = 4; // <hash-token>
export const String = 5; // <string-token>
export const BadString = 6; // <bad-string-token>
export const Url = 7; // <url-token>
export const BadUrl = 8; // <bad-url-token>
export const Delim = 9; // <delim-token>
export const Number = 10; // <number-token>
export const Percentage = 11; // <percentage-token>
export const Dimension = 12; // <dimension-token>
export const WhiteSpace = 13; // <whitespace-token>
export const CDO = 14; // <CDO-token>
export const CDC = 15; // <CDC-token>
export const Colon = 16; // <colon-token>     :
export const Semicolon = 17; // <semicolon-token> ;
export const Comma = 18; // <comma-token>     ,
export const LeftSquareBracket = 19; // <[-token>
export const RightSquareBracket = 20; // <]-token>
export const LeftParenthesis = 21; // <(-token>
export const RightParenthesis = 22; // <)-token>
export const LeftCurlyBracket = 23; // <{-token>
export const RightCurlyBracket = 24; // <}-token>
export const Comment = 25;
