import "@lynx-js/react/experimental/lazy/import";
import { __dynamicImport } from "@lynx-js/react/internal";
(async function() {
    await import(/*webpackChunkName: "./index.js-test"*/ "./index.js");
    await import(`./locales/${name}`);
    await import(/*webpackChunkName: "ftp://www/a.js-test"*/ "ftp://www/a.js");
    await __dynamicImport("https://www/a.js");
    await __dynamicImport(url);
    await __dynamicImport(url + "?v=1.0");
    await import(/*webpackChunkName: "./index.js-test"*/ "./index.js", {
        with: {
            type: "component"
        }
    });
    await import(/*webpackChunkName: "ftp://www/a.js-test"*/ "ftp://www/a.js", {
        with: {
            type: "component"
        }
    });
    await __dynamicImport("https://www/a.js", {
        with: {
            type: "component"
        }
    });
    await __dynamicImport(url, {
        with: {
            type: "component"
        }
    });
    await __dynamicImport(url + "?v=1.0", {
        with: {
            type: "component"
        }
    });
})();
