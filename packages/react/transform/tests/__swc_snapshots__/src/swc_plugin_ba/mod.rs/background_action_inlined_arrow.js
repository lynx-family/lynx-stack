function BTC() {
    const ba = (e)=>{
        'use background';
        console.log("background action", e);
    };
    return <MTC onClick={ba}/>;
}
