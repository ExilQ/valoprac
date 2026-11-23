import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const gates=JSON.parse(readFileSync('infrastructure/pixel-streaming/migration-gates.json','utf8'));
const config=JSON.parse(readFileSync('public/streaming-config.json','utf8'));
assert.equal(gates.defaultRuntime,'browser','Production must preserve the local renderer');
if(config.enabled){assert(Object.values(gates.gates).every(v=>v===true),'Unreal streaming may not be enabled before every migration gate passes');assert(config.allocatorUrl?.startsWith('https://'));assert(config.signallingHosts.length>0);}
assert.equal(config.engineVersion,'5.7');assert.equal(config.infrastructureCommit,'15f616198b7b33b1544f2a6a2d53b5f44e6ae707');
console.log(JSON.stringify({streamingEnabled:config.enabled,defaultRuntime:gates.defaultRuntime,passedGates:Object.values(gates.gates).filter(Boolean).length,totalGates:Object.keys(gates.gates).length}));
