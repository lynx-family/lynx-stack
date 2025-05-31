import init from './binary/tokenizer.js';
// import { tokenize } from '/root/repos/csstree/lib/tokenizer/index.js';
import { stringConsts } from './tmp/replace-rule-trie.js';

const tokenizer = await init();

const source =
  'height:300px; width:100px 200px !important; --var: #111111; color: red; background-image: url("https://example.com/image.png"); display: flex; display: linear !important; flex-direction: column;';
// const source =
// 'flex-direction: column;';
globalThis._source = source;
const sourcePtr = tokenizer._malloc((source.length + 1) * 2);
tokenizer.stringToUTF16(source, sourcePtr, (source.length + 1) * 2);
// @ts-expect-error
globalThis._tokenizer_on_declaration_callback = (
  start,
  end,
  replaceId,
  semicolon,
  isImportant,
) => {
  const originalValue = source.substring(start, semicolon);
  const newValue = stringConsts[replaceId];
  console.log(
    `Declaration: ${originalValue} -> ${newValue} (isImportant: ${isImportant}) with replaceId: ${replaceId}`,
  );
  // console.log(replaceId);
};
tokenizer._tokenize(sourcePtr, source.length);
// @ts-expect-error
globalThis._tokenizer_on_token_callback = null;
tokenizer._free(sourcePtr);

// tokenize(source, (type, start, end) => {
//   const token = source.substring(start, end);
//   console.log(type, token);
// })
