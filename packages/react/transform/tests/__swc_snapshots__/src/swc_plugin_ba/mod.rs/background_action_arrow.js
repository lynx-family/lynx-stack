const ba = (e)=>{
    'use background';
    console.log("background action", e);
};
function BTC() {
    return <MTC onClick={ba}/>;
}
