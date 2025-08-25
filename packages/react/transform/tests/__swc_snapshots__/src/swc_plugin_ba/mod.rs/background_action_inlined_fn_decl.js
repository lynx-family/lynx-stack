function BTC() {
    const ba = {
        __type: "$$mtc_ba",
        __runtimeId: ReactLynx.registerBgAction(function(e) {
            console.log("background action", e);
        })
    };
    return <MTC onClick={ba}/>;
}
