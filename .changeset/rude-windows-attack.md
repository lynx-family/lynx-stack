---
"@lynx-js/web-elements": patch
---

feat: 1. Added support for the list `estimated-main-axis-size-px` property; the width and height of `list-item` are no longer required.

2. Fixed an issue where the list `lower-threshold-item-count` event would not trigger when using a horizontal layout under a waterfall layout.

3. Fixed an issue where calling the list `autoScroll` method in `useEffect` might not scroll.

4. Fixed an issue where the `scrolltolower` event might not be triggered in waterfall, because the lower styles was not updated in `registerEventEnableStatusChangeHandler`.
