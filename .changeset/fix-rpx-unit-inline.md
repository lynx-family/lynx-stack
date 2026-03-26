---
"@lynx-js/web-core": patch
---

fix: tokenizing inline style values correctly to support rpx and ppx unit conversion

This fixes an issue where the `transform_inline_style_key_value_vec` API bypassed the CSS tokenizer, preventing dimension units like `rpx` or `ppx` from being successfully transformed into `calc` strings when specified via inline styles.
