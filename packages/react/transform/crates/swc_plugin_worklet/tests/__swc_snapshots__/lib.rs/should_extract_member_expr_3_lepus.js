import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime;
let enableScroll = {
    _c: {
        containerID,
        a,
        b,
        f
    },
    _wkltId: "a123:test:1"
};
let makeVelocityIfRequired = {
    _wkltId: "a123:test:2"
};
loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "a123:test:1", function(enable: boolean) {
    const enableScroll = lynxWorkletImpl._workletMap["a123:test:1"].bind(this);
    let { containerID, a, b, f } = this["_c"];
    'main thread';
    lynx.querySelector(`#${containerID}`)?.setAttribute('enable-scroll', enable);
    (a + b).c.d;
    ({
        e: f
    }).e;
});
loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "a123:test:2", function(nodeRef: MainThreadRef<Velocity>, velocity: boolean) {
    const makeVelocityIfRequired = lynxWorkletImpl._workletMap["a123:test:2"].bind(this);
    'main thread';
    class Velocity implements Velocity {
        constructor(velocity: boolean){
            this.enabled = velocity;
        }
        positionQueue = [];
        timeQueue = [];
        enabled = true;
        reset = ()=>{
            this.positionQueue = [];
            this.timeQueue = [];
        };
        getVelocity = ()=>{
            if (!this.enabled) {
                return {
                    velocity: 0,
                    direction: 0
                };
            }
            this.pruneQueue(500);
            const { length } = this.timeQueue;
            if (length < 2) {
                return {
                    velocity: 0,
                    direction: 1
                };
            }
            const distance = this.positionQueue[length - 1] - this.positionQueue[0];
            const time = (this.timeQueue[length - 1] - this.timeQueue[0]) / 1000;
            return {
                velocity: distance / time,
                direction: distance > 0 ? 1 : -1
            };
        };
        updatePosition = (position: number)=>{
            if (!this.enabled) {
                return;
            }
            this.positionQueue.push(position);
            this.timeQueue.push(Date.now());
            this.pruneQueue(50);
            console.log('updatePosition done', position);
        };
        pruneQueue = (ms: number)=>{
            if (!this.enabled) {
                return;
            }
            const nowTs = Date.now();
            // pull old values off of the queue
            while(this.timeQueue.length && this.timeQueue[0] < nowTs - ms){
                this.timeQueue.shift();
                this.positionQueue.shift();
            }
        };
    }
    if (nodeRef && nodeRef.current) {
        nodeRef.current.reset();
        return nodeRef.current;
    } else {
        return new Velocity(velocity);
    }
});
