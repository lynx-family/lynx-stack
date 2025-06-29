---
"@lynx-js/react": patch
---

Fixed: An issue where the `lynxViewDidUpdate` callback did not trigger when data was updated from native.

Notice:

- Even if no data changes are actually processed after calling `updateData()`, the `lynxViewDidUpdate` callback will still be triggered.
- Only one `lynxViewDidUpdate` callback will be triggered per render cycle. Consequently, if multiple `updateData()` calls are made within a single cycle but the data updates are batched, the number of `lynxViewDidUpdate` callbacks triggered may be less than the number of `updateData()` calls.
