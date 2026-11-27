---
"@lynx-js/css-extract-webpack-plugin": patch
---

Make the CSS hot update runtime work on web, where there is no `lynx.__chunk_entries__`. It threw a `TypeError` there; it now sends the update of the card's own chunk without an entry, which web-core applies to the card. The CSS of async chunks is not hot-updated on web.
