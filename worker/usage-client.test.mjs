import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/usage.js',import.meta.url),'utf8');
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(r=>setImmediate(r));};
function browser({storage=new Map(),deny=false,privacy=false}={}){
 const calls=[],events=new Map();let clock=Date.UTC(2026,10,17,12),issued=0;
 const location={origin:'https://valoprac.trade',hostname:'valoprac.trade',pathname:'/training',search:''};
 const sessionStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 const context={location,document:{referrer:''},navigator:{globalPrivacyControl:privacy},sessionStorage,URL,URLSearchParams,Date:{now:()=>clock},history:{pushState(){},replaceState(){}},window:{},addEventListener:(name,callback)=>events.set(name,callback),fetch:async(path,options)=>{
  const event=JSON.parse(options.body);calls.push({path,options,event});
  if(path==='/api/usage/session'){if(deny)return{ok:false,status:429};issued++;return{ok:true,status:200,json:async()=>({id:'server-'+issued,token:'signed-fixture-'+issued,test:event.test,expiresAt:clock+1800000})};}
  assert.match(options.headers.Authorization,/^Bearer signed-fixture-/);assert.match(event.id,/^server-/);return{ok:true,status:204};
 }};
 runInNewContext(source,context);
 return{calls,events,storage,location,advance:ms=>clock+=ms};
}
test('client obtains server admission, preserves queue ordering, and de-duplicates starts',async()=>{
 const f=browser();f.events.get('valoprac:training-started')();f.events.get('valoprac:training-started')();await flush();
 assert.deepEqual(f.calls.map(c=>c.path),['/api/usage/session','/api/usage','/api/usage']);
 assert.deepEqual(f.calls.slice(1).map(c=>c.event.type),['view','start']);assert.equal(f.calls[1].event.id,f.calls[2].event.id);
});
test('same-route training after grant expiry records a fresh view before its start',async()=>{
 const f=browser();await flush();f.events.get('valoprac:training-started')();await flush();
 f.advance(1800001);f.events.get('valoprac:training-started')();await flush();
 assert.deepEqual(f.calls.slice(-3).map(c=>c.path==='/api/usage/session'?'mint':c.event.type),['mint','view','start']);
 assert.equal(f.calls.at(-1).event.id,'server-2');assert.equal(f.calls.at(-2).event.id,'server-2');
});
test('admission rejection has no unsigned fallback and privacy opt-out makes no requests',async()=>{
 const f=browser({deny:true});await flush();assert.deepEqual(f.calls.map(c=>c.path),['/api/usage/session']);
 const opted=browser({privacy:true});await flush();assert.equal(opted.calls.length,0);
});
