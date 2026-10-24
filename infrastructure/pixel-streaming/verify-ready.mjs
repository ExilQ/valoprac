#!/usr/bin/env node
// Use Node >= 22 with the standard WebSocket client. No frontend package is required.
const [port,id]=process.argv.slice(2);if(!/^\d+$/.test(port)||!id)process.exit(2);
const deadline=Date.now()+55000;
async function probe(){return new Promise(resolve=>{let done=false;const socket=new WebSocket(`ws://127.0.0.1:${port}`);const finish=result=>{if(done)return;done=true;clearTimeout(timeout);socket.close();resolve(result);};const timeout=setTimeout(()=>finish(false),2000);socket.addEventListener('open',()=>socket.send(JSON.stringify({type:'listStreamers'})));socket.addEventListener('message',e=>{try{const m=JSON.parse(String(e.data));if(m.type==='streamerList')finish(m.ids?.includes(id)===true);}catch{finish(false);}});socket.addEventListener('error',()=>finish(false));});}
while(Date.now()<deadline){if(await probe())process.exit(0);await new Promise(r=>setTimeout(r,500));}process.exit(1);
