# Upstream sources

`basic-functions.json` contains the function definitions from
[`catalogs/basic/v1/catalog.json`](https://github.com/a2ui-project/a2ui/blob/24d1bf9c830071f74c9c908433e73cc6cbe0aa33/catalogs/basic/v1/catalog.json).

`regexSubset.ts` adapts
[`typescript/core/web_core/src/common/regex_subset.ts`](https://github.com/a2ui-project/a2ui/blob/24d1bf9c830071f74c9c908433e73cc6cbe0aa33/typescript/core/web_core/src/common/regex_subset.ts).
Changes are formatting, strict TypeScript index annotations, and explicit callback wrappers required by repository lint rules. The upstream
Google copyright and Apache-2.0 license notice are retained.

Both are pinned to `24d1bf9c830071f74c9c908433e73cc6cbe0aa33`. Keep their revision
aligned with the protocol schema fixtures. Formatting and validation algorithms
in `index.ts` implement the same documented 1.0 contract without importing the
Web SDK's version compatibility layers or native-incompatible tokenizer.
