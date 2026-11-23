import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
const secret=()=>randomBytes(32).toString('base64url');
export function equal(a,b){
 if(typeof a!=='string'||typeof b!=='string')return false;
 const left=Buffer.from(a),right=Buffer.from(b);
 return left.length===right.length&&timingSafeEqual(left,right);
}
const cancelled=()=>Object.assign(new Error('Lease cancelled'),{name:'AbortError'});
// A slot remains reserved until startup has settled AND every worker process has stopped.
// A failed stop quarantines its slot rather than reusing an unknown GPU process.
export class LeasePool {
 constructor({worker,capacity=1,ttlMs=90000,now=Date.now,onError=()=>{}}){
  if(!Number.isInteger(capacity)||capacity<1||capacity>16)throw new Error('Invalid capacity');
  if(!Number.isFinite(ttlMs)||ttlMs<=0)throw new Error('Invalid lease lifetime');
  this.worker=worker;this.capacity=capacity;this.ttl=ttlMs;this.now=now;this.onError=onError;this.leases=new Map();this.closing=false;
 }
 async allocate({signal}={}){
  if(signal?.aborted)throw cancelled();
  if(this.closing||this.leases.size>=this.capacity)throw Object.assign(new Error('No independent GPU session available'),{status:503});
  const used=new Set([...this.leases.values()].map(x=>x.slot));let slot=0;while(used.has(slot))slot++;
  const lease={id:randomUUID(),token:secret(),signalToken:secret(),slot,expires:this.now()+this.ttl,state:'starting',socket:null,worker:null,abort:new AbortController(),releasePromise:null,startPromise:null};
  this.leases.set(lease.id,lease);
  const release=()=>{void this.release(lease.id).catch(this.onError);};
  // Assign the startup promise before invoking user code or accepting cancellation.
  lease.startPromise=Promise.resolve().then(()=>{
   if(lease.abort.signal.aborted)throw cancelled();
   return this.worker.start(lease.id,slot,{signal:lease.abort.signal,onExit:release});
  }).then(worker=>{lease.worker=worker;return worker;});
  signal?.addEventListener('abort',release,{once:true});
  try{
   await lease.startPromise;
   if(this.closing||lease.abort.signal.aborted||lease.state!=='starting')throw cancelled();
   lease.state='ready';lease.expires=this.now()+this.ttl;return lease;
  }catch(error){await this.release(lease.id);throw error;}
  finally{signal?.removeEventListener('abort',release);}
 }
 authenticate(id,token){const l=this.leases.get(id);return l?.state==='ready'&&l.expires>this.now()&&(l.authorizationExpires===undefined||l.authorizationExpires>this.now())&&equal(l.token,token)?l:null;}
 signal(id,token){const l=this.leases.get(id);return l?.state==='ready'&&l.expires>this.now()&&(l.authorizationExpires===undefined||l.authorizationExpires>this.now())&&!l.socket&&equal(l.signalToken,token)?l:null;}
 heartbeat(lease){if(lease.state!=='ready'||this.leases.get(lease.id)!==lease||lease.authorizationExpires!==undefined&&lease.authorizationExpires<=this.now())return false;lease.expires=this.now()+this.ttl;return true;}
 release(id){
  const l=this.leases.get(id);if(!l)return Promise.resolve();if(l.releasePromise)return l.releasePromise;
  l.state='stopping';l.abort.abort();l.socket?.destroy();
  l.releasePromise=Promise.resolve().then(async()=>{
   try{await l.startPromise;}catch{/* A rejected starter must clean up its own partial processes. */}
   await l.worker?.stop();
   this.leases.delete(id);
  });
  return l.releasePromise;
 }
 async reap(){await Promise.all([...this.leases.values()].filter(l=>l.expires<=this.now()||l.authorizationExpires!==undefined&&l.authorizationExpires<=this.now()).map(l=>this.release(l.id)));}
 close(){this.closing=true;return Promise.all([...this.leases.keys()].map(id=>this.release(id)));}
}
