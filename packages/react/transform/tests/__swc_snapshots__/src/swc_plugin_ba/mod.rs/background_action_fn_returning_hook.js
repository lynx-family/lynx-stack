function BTC() {
    const ba = {
        __type: "$$mtc_ba",
        __runtimeId: ReactLynx.registerBgAction(ReactLynx.useCallback((e)=>{
            console.log("useCallback arrow", e);
        }))
    };
    const ba2 = {
        __type: "$$mtc_ba",
        __runtimeId: ReactLynx.registerBgAction(ReactLynx.useCallback(function(e) {
            console.log("useCallback function", e);
        }))
    };
    const ba3 = {
        __type: "$$mtc_ba",
        __runtimeId: ReactLynx.registerBgAction(ReactLynx.useMemo(()=>{
            return (e)=>{
                console.log("useMemo arrow", e);
            };
        }))
    };
    const ba4 = {
        __type: "$$mtc_ba",
        __runtimeId: ReactLynx.registerBgAction(ReactLynx.useMemo(function() {
            return function(e) {
                console.log("seMemo function", e);
            };
        }))
    };
    return <MTC onClick={ba} onMouseEnter={ba2} onFocus={ba3} onBlur={ba4}/>;
}
