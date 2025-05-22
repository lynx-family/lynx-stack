import { createContext } from '@lynx-js/react';
export function aaa(a, b) {
    const context = Object.assign(createContext[`__file_hash__$context1_${a}${b}`] || (createContext[`__file_hash__$context1_${a}${b}`] = createContext({
        key: "value"
    })), {
        __: {
            key: "value"
        }
    });
}
