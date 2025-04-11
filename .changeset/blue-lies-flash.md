---
"@lynx-js/web-worker-runtime": patch
"@lynx-js/web-constants": patch
"@lynx-js/web-core": patch
---

feat: allow multi lynx-view to share bts worker

Now we allow users to enable so-called "shared-context" feature on the Web Platform.

Similar to the same feature for Lynx iOS/Android, this feature let multi lynx cards to share one js context.

The `lynx.getSharedData` and `lynx.setSharedData` are also supported in this commit.

To enable this feature, set property `lynxGroupId` or attribute `lynx-group-id` before a lynx-view starts rendering. Those card with same context id will share one web worker for the bts scripts.
