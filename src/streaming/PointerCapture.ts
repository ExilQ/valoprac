// Capture admission is independent from UI rendering and rejects late async completions.
export class CaptureGate {
 private generation=0;private abort:AbortController|null=null;
 constructor(private request:(signal:AbortSignal)=>Promise<void>,private owned:()=>boolean,private release:()=>void){}
 async acquire(){this.cancel();const generation=this.generation;const abort=new AbortController();this.abort=abort;
  try{await this.request(abort.signal);if(abort.signal.aborted||generation!==this.generation||!this.owned()){if(this.abort===null&&this.owned())this.release();return false;}return true;}catch(e){if(this.abort===abort)this.abort=null;if(abort.signal.aborted||generation!==this.generation)return false;throw e;}
 }
 cancel(){this.generation++;this.abort?.abort();this.abort=null;}
 dispose(){this.cancel();if(this.owned())this.release();}
}
const latestRequest=new WeakMap<HTMLElement,symbol>();
export function requestStreamPointerLock(host:HTMLElement,signal:AbortSignal){
 return new Promise<void>((resolve,reject)=>{
  if(signal.aborted){reject(new DOMException('Cancelled','AbortError'));return;}
  const token=Symbol();latestRequest.set(host,token);let settled=false,cleaned=false;
  const cleanup=()=>{if(cleaned)return;cleaned=true;clearTimeout(timer);document.removeEventListener('pointerlockchange',changed);document.removeEventListener('pointerlockerror',failed);signal.removeEventListener('abort',aborted);};
  const settle=(error?:unknown)=>{if(settled)return;settled=true;error?reject(error):resolve();};
  const releaseLate=()=>{if(signal.aborted&&latestRequest.get(host)===token&&document.pointerLockElement===host)document.exitPointerLock();};
  const changed=()=>{if(document.pointerLockElement!==host)return;releaseLate();settle(signal.aborted?new DOMException('Cancelled','AbortError'):undefined);cleanup();};
  const failed=()=>{settle(new Error('마우스 잠금이 거부되었습니다.'));cleanup();};
  // Keep a bounded observer after cancellation for void-returning Pointer Lock implementations.
  // It releases a late native lock, without releasing a newer request on the same element.
  const aborted=()=>{settle(new DOMException('Cancelled','AbortError'));releaseLate();};
  const timer=setTimeout(()=>{settle(new Error('마우스 잠금 응답이 지연되었습니다.'));cleanup();},5000);
  document.addEventListener('pointerlockchange',changed);document.addEventListener('pointerlockerror',failed);signal.addEventListener('abort',aborted,{once:true});
  const request=async()=>{try{await host.requestPointerLock({unadjustedMovement:true});}catch(error){if(signal.aborted)throw error;if(error instanceof DOMException&&error.name==='NotSupportedError')await host.requestPointerLock();else throw error;}releaseLate();changed();};
  void request().catch(error=>{settle(error);cleanup();});
 });
}
