function main() {
  try {
    lynx.getJSContext().addEventListener('lynx.hmr.css', (event) => {
      try {
        const { data: { cssId, content, deps, entry } } = event;
        // Update the css deps first because the css deps are updated actually.
        if (Array.isArray(deps[cssId])) {
          deps[cssId].forEach(depCSSId => {
            lynx.getDevtool().replaceStyleSheetByIdWithBase64(
              Number(depCSSId),
              content,
              entry,
            );
          });
        }

        lynx.getDevtool().replaceStyleSheetByIdWithBase64(
          Number(cssId),
          content,
          entry,
        );

        __FlushElementTree();
      } catch (error) {
        // TODO: use webpack-dev-server logger
        console.error(error);
      }
    });
  } catch (error) {
    // TODO: use webpack-dev-server logger
    console.warn(`[HMR] no lynx.getJSContext() found, will not HMR CSS`);
    console.warn(error);
  }
}

main();
