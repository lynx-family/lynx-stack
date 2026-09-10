---
"@lynx-js/react-webpack-plugin": patch
---

Encode the element templates of a lazy bundle into that lazy bundle. Its chunk groups come from dynamic imports and have no name, so looking them up in `compilation.namedChunkGroups` found nothing and every Element Template lazy bundle shipped without its templates: the main thread could not create them, the lazy component never rendered, and a development build reported `No BehaviorController defined for class template`.
