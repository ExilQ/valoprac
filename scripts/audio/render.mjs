// Render the synthesized sound catalog to 16-bit WAV files plus metrics.json.
// Usage: node scripts/audio/render.mjs <outDir> [catalogModule]
import {createRequire} from 'node:module';import {mkdirSync,writeFileSync} from 'node:fs';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),esbuild=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}));
const out=resolve(process.argv[2]??'audio-render'),entry=resolve(process.argv[3]??'scripts/audio/catalog.ts');mkdirSync(out,{recursive:true});
const bundle=join(out,'catalog.bundle.mjs');
esbuild.buildSync({entryPoints:[entry],bundle:true,format:'esm',platform:'node',outfile:bundle,logLevel:'error'});
const {catalog}=await import(pathToFileURL(bundle).href);
const RATE=48000,items=catalog(RATE),metrics=[];
for(const item of items){
  const ch=item.channels,n=ch[0].length,frames=Buffer.alloc(44+n*ch.length*2);
  frames.write('RIFF',0);frames.writeUInt32LE(frames.length-8,4);frames.write('WAVEfmt ',8);frames.writeUInt32LE(16,16);frames.writeUInt16LE(1,20);frames.writeUInt16LE(ch.length,22);frames.writeUInt32LE(RATE,24);frames.writeUInt32LE(RATE*2*ch.length,28);frames.writeUInt16LE(2*ch.length,32);frames.writeUInt16LE(16,34);frames.write('data',36);frames.writeUInt32LE(n*ch.length*2,40);
  let peak=0,sum=0,clipped=0,firstLoud=-1;for(let i=0;i<n;i++)for(let c=0;c<ch.length;c++){const v=ch[c][i];const a=Math.abs(v);if(a>peak)peak=a;sum+=v*v;if(a>=.999)clipped++;frames.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(v*32767))),44+(i*ch.length+c)*2);}
  writeFileSync(join(out,`${item.name}.wav`),frames);
  metrics.push({name:item.name,group:item.group,channels:ch.length,seconds:+(n/RATE).toFixed(3),peak:+peak.toFixed(3),rmsDb:+(10*Math.log10(sum/(n*ch.length)+1e-12)).toFixed(1),clipped});
}
writeFileSync(join(out,'metrics.json'),JSON.stringify(metrics,null,1));
console.log(`Rendered ${items.length} sounds to ${out}`);
