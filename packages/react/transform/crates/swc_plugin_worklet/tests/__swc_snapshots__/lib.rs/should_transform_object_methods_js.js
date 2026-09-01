import { createValue } from './shared.js' with {
    runtime: "shared"
};
const valueType = defineMainThreadObjectType({
    type: '@test/value',
    create: {
        _wkltId: "a77b:test:1"
    }
});
