import {analyzeAim,compactTrace} from './analyzer';
import type {AimMeta} from './types';
self.onmessage=(event:MessageEvent<{id:number;meta:AimMeta;buffer:Float64Array}>)=>{const {id,meta,buffer}=event.data;try{self.postMessage({id,result:{meta,metrics:analyzeAim(buffer,meta),trace:compactTrace(buffer)}});}catch{self.postMessage({id,error:true});}};
