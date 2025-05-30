(async function() {
    await import(/*webpackChunkName: "./index.js-test"*/ "./index.js");
    await import(`./locales/${name}`);
    await import(/*webpackChunkName: "ftp://www/a.js-test"*/ "ftp://www/a.js");
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
})();
