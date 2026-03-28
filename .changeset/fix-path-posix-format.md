---
'@lynx-js/template-webpack-plugin': patch
---

use path.posix.format instead of path.format to ensure consistent path separators across platforms
