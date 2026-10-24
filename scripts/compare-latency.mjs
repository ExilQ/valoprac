import {readFileSync} from 'node:fs';
// Consume externally measured CSV. Never synthesize missing observations.
// CSV: runtime,metric,milliseconds. metric: mouse-to-photon,click-to-shot,shot-to-photon.
const path=process.argv[2];if(!path)throw new Error('Provide real measured CSV: runtime,metric,milliseconds');
const lines=readFileSync(path,'utf8').trim().split(/\r?\n/);if(lines.shift()!=='runtime,metric,milliseconds')throw new Error('Invalid CSV header');
const groups=new Map();for(const line of lines){const [runtime,metric,value,...extra]=line.split(',');const n=Number(value);if(extra.length||!['browser','unreal'].includes(runtime)||!['mouse-to-photon','click-to-shot','shot-to-photon'].includes(metric)||!value||!Number.isFinite(n)||n<0)throw new Error('Invalid measurement row');const key=`${runtime}:${metric}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(n);}
const result={method:'Externally measured input/shot timing supplied by operator',groups:{}};
for(const [key,values] of groups){values.sort((a,b)=>a-b);result.groups[key]={n:values.length,median:values[Math.floor(values.length*.5)],p95:values[Math.floor(values.length*.95)],minimum:values[0],maximum:values.at(-1)};}
console.log(JSON.stringify(result,null,2));
