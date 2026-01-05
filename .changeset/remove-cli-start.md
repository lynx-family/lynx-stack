---
"@lynx-js/rspeedy": minor
---

**BREAKING CHANGE**: Remove the CLI version selector and the `--unmanaged` flag.

Rspeedy will no longer automatically attempt to use the locally installed version when the CLI is invoked.

Please uninstall your globally installed version of Rspeedy:

```bash
npm uninstall -g @lynx-js/rspeedy
```
