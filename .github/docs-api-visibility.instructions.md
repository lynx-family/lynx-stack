---
applyTo: "docs/plugins/**"
---

Use the consuming site's docs/shown-packages.json to select standalone TypeDoc entry points, fallback pages, navigation, and manifest entries. Keep dedicated sections independent. Render references to known hidden packages as text before resolution; retain invalid-link validation for shown and unknown targets. Preserve explicit source type annotations when hidden imports resolve to any, without rewriting source-authored any. Do not claim unresolved inheritance is expanded or remove dependency builds without a clean-build validation. Audit consumer-owned API navigation and legacy redirect targets before removing a package; a package outside the plugins menu may still be shown in another group, such as Testing.
