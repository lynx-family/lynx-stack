// Strips CSS runtime injection code from Lynx main-thread bundles.
// CssExtractRspackPlugin (used when injectStyles:false) still injects HMR
// reload code into CSS JS modules. That code calls document.createElement
// etc. which don't exist in Lynx's JS runtime and crash.
// The CSS itself is extracted as an asset by CssExtractRspackPlugin and
// embedded in the .lynx.bundle by LynxTemplatePlugin — so the JS module
// just needs to export nothing.
module.exports = function ignoreCssLoader() {
  this.cacheable(true);
  return 'export {}';
};
