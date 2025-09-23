function BTC() {
    return <MTC onClick={{
        __type: "$$mtc_ba",
        __runtimeId: ReactLynx.registerBgAction((e)=>{
            console.log("background action", e);
        })
    }}/>;
}
