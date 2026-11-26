/// <reference lib="webworker" />
import {renderSound} from './soundBank';
/** Renders procedural sounds off the main thread and transfers the PCM. */
self.onmessage=(event:MessageEvent<{keys:string[];rate:number}>)=>{
  const {keys,rate}=event.data;
  for(const key of keys){
    try{const channels=renderSound(key,rate);if(channels)(self as unknown as DedicatedWorkerGlobalScope).postMessage({key,rate,channels},channels.map(c=>c.buffer));}
    catch{/* The main thread renders a missing key on first use. */}
  }
  (self as unknown as DedicatedWorkerGlobalScope).postMessage({done:true});
};
