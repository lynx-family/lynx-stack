import { useEffect } from "@lynx-js/react-runtime";
const myUseEffect = useEffect;
export function A() {
    useEffect();
    myUseEffect(()=>{
        console.log("remove myUseEffect");
    });
}
