---
"@lynx-js/template-webpack-plugin": minor
---

Enable `syncXElementRegistry` in the generated page config by default.

This lets the runtime sync the XElement registry during page setup, so the open-source `<input>` / `<textarea>` map to the new XElement implementation (`x-input-ng` / `x-textarea-ng`) instead of the deprecated legacy elements.
