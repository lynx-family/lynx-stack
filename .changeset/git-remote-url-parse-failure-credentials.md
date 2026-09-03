---
"@lynx-js/debug-metadata-rsbuild-plugin": patch
---

Drop `remoteUrl` instead of leaking its embedded credentials when the git remote fails to parse as a URL (e.g. a host-less `https://user:pass@/owner/repo`).
