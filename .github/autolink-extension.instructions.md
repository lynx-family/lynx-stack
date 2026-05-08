# Native Autolink Extension Instructions

Use the current Native Autolink package names and marker names when creating or
updating Lynx extensions.

- The codegen package is `@lynx-js/autolink-codegen`.
- The codegen binary is `lynx-autolink-codegen`.
- Create new extensions with `create-lynx-extension`.
- Android extension APIs use only the Autolink names:
  `LynxAutolinkElement`, `LynxAutolinkNativeModule`, and
  `LynxAutolinkService`.
- iOS extension APIs should use `@LynxAutolinkUI`,
  `@LynxAutolinkNativeModule`, and `@LynxAutolinkService`.
- Do not generate or document RFC-draft marker names such as `@LynxElement`,
  `@LynxNativeModule`, `@LynxService`, or `LynxNativeModule("...")`.
- The current create-extension and codegen packages are Native-only. Do not add
  Web Autolink or Web spec output in these packages.

iOS Autolink scanners in the native repo may still recognize existing Lynx lazy
registration forms for compatibility, but new generated templates should prefer
the Autolink marker names above.
