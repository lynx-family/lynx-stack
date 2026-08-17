---
"@lynx-js/react": patch
---

Reduce repeated snapshot creation payloads by referencing types already declared
earlier in the same patch, while keeping patches with fewer than three creates
byte-for-byte unchanged.
