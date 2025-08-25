function BTC() {
    const ba = function(e) {
        'use background';
        console.log("background action", e);
    };
    return <MTC onClick={ba}/>;
}
