---
applyTo: "packages/rspeedy/core/**/dev.plugin*.ts"
---

Keep automatically selected dev-server bind addresses separate from client-facing hostnames. Bind IPv4 on `0.0.0.0` and IPv6 on `::`, while using the detected concrete address for asset and HMR URLs. Do not narrow the listener to the advertised address because loopback clients use a different local address.
