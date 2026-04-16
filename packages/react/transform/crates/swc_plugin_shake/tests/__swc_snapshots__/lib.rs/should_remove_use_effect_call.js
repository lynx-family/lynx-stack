import { useEffect } from "@lynx-js/react-runtime";
const myUseEffect = useEffect;
export function A() {
    ;
    myUseEffect(()=>{
        console.log("remove myUseEffect");
    });
}
