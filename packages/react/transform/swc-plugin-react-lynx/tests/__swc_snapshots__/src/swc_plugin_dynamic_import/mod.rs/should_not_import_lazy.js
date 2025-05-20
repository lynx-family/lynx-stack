(async function() {
    await import("./index.js");
    await import(`./locales/${name}`);
    await import("ftp://www/a.js");
    await import("./index.js", {
        with: {
            type: "component"
        }
    });
    await import("ftp://www/a.js", {
        with: {
            type: "component"
        }
    });
})();
