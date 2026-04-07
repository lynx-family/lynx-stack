import { useEffect } from "@lynx-js/custom-react-runtime";
export function A() {
    useEffect(()=>{
        console.log("keep useEffect from custom runtime");
    });
}
