---
"@lynx-js/debug-metadata-rsbuild-plugin": patch
---

Stop emitting `debug-metadata.json` in production builds unless `DEBUG=rspeedy`. Previously an `RSDOCTOR=true` build leaked the file into the output, because `LynxEncodePlugin`'s intermediate-asset cleanup is skipped under Rsdoctor (it keeps intermediate files split so Rsdoctor can analyse them). The debug-metadata plugin now strips the asset itself. Dev builds keep it in memory so the debug-metadata middleware can still serve it.
