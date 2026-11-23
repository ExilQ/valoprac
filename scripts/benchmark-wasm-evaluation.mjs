import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';

// Original, hand-encoded WebAssembly, compiled by the JavaScript engine. This
// is an isolated boundary/copy experiment, not a Rust-compiled engine port.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arg=name=>{const at=process.argv.indexOf(name);return at<0?undefined:process.argv[at+1];};
const hash=value=>createHash('sha256').update(value).digest('hex');
const sourcePath=path.join(root,'src/engine/movement/MovementSolvers.ts');
const sourceBefore=await readFile(sourcePath,'utf8'),scriptBefore=await readFile(fileURLToPath(import.meta.url),'utf8');
const uleb=value=>{const bytes=[];do{const byte=value&127;value=Math.floor(value/128);bytes.push(byte|(value?128:0));}while(value);return bytes;};
const sleb=value=>{const bytes=[];let more=true;while(more){const byte=value&127;value>>=7;more=!((value===0&&(byte&64)===0)||(value===-1&&(byte&64)!==0));bytes.push(byte|(more?128:0));}return bytes;};
const utf8=value=>[...uleb(Buffer.byteLength(value)),...Buffer.from(value)];
const section=(id,body)=>[id,...uleb(body.length),...body];
const vector=items=>[...uleb(items.length),...items.flat()];
const get=index=>[0x20,...uleb(index)],set=index=>[0x21,...uleb(index)],i32=value=>[0x41,...sleb(value)];
const f64=value=>{const bytes=new Uint8Array(8);new DataView(bytes.buffer).setFloat64(0,value,true);return[0x44,...bytes];};
const body=(locals,instructions)=>{const bytes=[...vector(locals),...instructions,0x0b];return[...uleb(bytes.length),...bytes];};

// Parameter order: vx, vz, wishX, wishZ, wishLimit, airAccel, dt, wishSpeed.
function projectedAirAcceleration(vx,vz,wishX,wishZ,wishLimit,airAccel,dt,wishSpeed){
  const current=vx*wishX+vz*wishZ,requested=airAccel*wishSpeed*dt;
  return Math.min(requested,Math.max(0,wishLimit-current));
}
const scalarCode=[
  ...get(5),...get(7),0xa2,...get(6),0xa2, // requested=(airAccel*wishSpeed)*dt
  ...f64(0),...get(4),...get(0),...get(2),0xa2,...get(1),...get(3),0xa2,0xa0,0xa1,
  0xa5,0xa4, // f64.max(+0, available); f64.min(requested, available)
];
const batchCode=[0x02,0x40,0x03,0x40,...get(1),0x45,0x0d,1,...get(2)];
for(let field=0;field<8;field++)batchCode.push(...get(0),0x2b,3,...uleb(field*8)); // aligned f64.load
batchCode.push(0x10,0,0x39,3,0, // call scalar; f64.store
  ...get(0),...i32(64),0x6a,...set(0),...get(2),...i32(8),0x6a,...set(2),
  ...get(1),...i32(1),0x6b,...set(1),0x0c,0,0x0b,0x0b);
const moduleBytes=new Uint8Array([
  0,97,115,109,1,0,0,0,
  ...section(1,vector([[0x60,...vector(Array.from({length:8},()=>[0x7c])),1,0x7c],[0x60,3,0x7f,0x7f,0x7f,0]])),
  ...section(3,vector([[0],[1]])),
  ...section(5,[1,0,2]), // one memory, minimum two 64 KiB pages
  ...section(7,vector([[...utf8('scalar'),0,0],[...utf8('batch'),0,1],[...utf8('memory'),2,0]])),
  ...section(10,vector([body([],scalarCode),body([],batchCode)])),
]);
assert(WebAssembly.validate(moduleBytes),'Hand-encoded module must validate');
const module=new WebAssembly.Module(moduleBytes),{scalar,batch,memory}=new WebAssembly.Instance(module).exports;
const maxBatch=1024,inputPtr=0,outputPtr=maxBatch*8*8;
assert(outputPtr+maxBatch*8<=memory.buffer.byteLength);
const memoryInputs=new Float64Array(memory.buffer,inputPtr,maxBatch*8),memoryOutputs=new Float64Array(memory.buffer,outputPtr,maxBatch);

let randomState=1200721;
const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
const rows=[
  [0,0,1,0,0,10,1/120,5.4],[-0,0,1,0,0,-0,1/120,5.4],
  [0,0,1,0,1,-0,1/120,5.4],[0,0,1,0,1,0,1/120,5.4],
  [0,0,1,0,1,10,-0,5.4],[0,0,1,0,1,10,1/120,-0],
  [1,0,1,0,1,10,1/120,5.4],[1,0,1,0,1+Number.EPSILON,10,1/120,5.4],
  [1,0,1,0,1-Number.EPSILON,10,1/120,5.4],
  [0,0,1,0,Number.MIN_VALUE,10,Number.MIN_VALUE,5.4],
  [0,0,1,0,Number.MAX_VALUE,Number.MIN_VALUE,Number.MIN_VALUE,Number.MIN_VALUE],
];
for(let field=0;field<8;field++)for(const zero of [0,-0]){const row=[2,-3,.6,.8,1.2,12,1/120,5.4];row[field]=zero;rows.push(row);}
const edgeCases=rows.length;
for(let i=0;i<32768;i++){
  const angle=random()*Math.PI*2;
  rows.push([(random()-.5)*50,(random()-.5)*50,Math.cos(angle),Math.sin(angle),random()*5.4,10+random()*10,1/(30+random()*482),random()*8]);
}
const corpus=new Float64Array(rows.flat()),expected=new Float64Array(rows.length);
const inputSnapshot=hash(Buffer.from(corpus.buffer)),parity={finiteInputRows:rows.length,seededRows:32768,edgeRows:edgeCases,scalarComparisons:0,batchComparisons:0,batchZeroCountChecked:false,positiveZeroResults:0,negativeZeroResults:0,mismatches:0};
assert(corpus.every(Number.isFinite));
for(let row=0;row<rows.length;row++){
  const wanted=projectedAirAcceleration(...rows[row]),actual=scalar(...rows[row]);assert(Number.isFinite(wanted));
  assert(Object.is(actual,wanted),`Scalar exact parity at row ${row}`);expected[row]=wanted;parity.scalarComparisons++;
  if(Object.is(wanted,0))parity.positiveZeroResults++;if(Object.is(wanted,-0))parity.negativeZeroResults++;
}
const outputArrays=new Map();
for(const count of [1,16,128,1024]){
  const output=new Float64Array(count);outputArrays.set(count,output);
  for(let start=0;start<rows.length;start+=count){
    const used=Math.min(count,rows.length-start);memoryInputs.set(corpus.subarray(start*8,(start+used)*8));
    batch(inputPtr,used,outputPtr);output.set(memoryOutputs.subarray(0,used),0);
    for(let i=0;i<used;i++){assert(Object.is(output[i],expected[start+i]),`Batch ${count} exact parity at row ${start+i}`);parity.batchComparisons++;}
  }
}
memoryOutputs[0]=-12345;batch(inputPtr,0,outputPtr);assert.equal(memoryOutputs[0],-12345);parity.batchZeroCountChecked=true;
assert.equal(hash(Buffer.from(corpus.buffer)),inputSnapshot,'Inputs must remain unchanged');assert(parity.negativeZeroResults>0);
if(process.argv.includes('--parity-only')){console.log(JSON.stringify({moduleBytes:moduleBytes.length,moduleSha256:hash(moduleBytes),parity},null,2));process.exit(0);}

const benchRows=1024,benchInputs=corpus.subarray(edgeCases*8,(edgeCases+benchRows)*8);
let checksumSink=0;
function scalarJS(passes){
  let checksum=0;const start=performance.now();
  for(let repeat=0;repeat<passes;repeat++)for(let i=0;i<benchInputs.length;i+=8)checksum+=projectedAirAcceleration(benchInputs[i],benchInputs[i+1],benchInputs[i+2],benchInputs[i+3],benchInputs[i+4],benchInputs[i+5],benchInputs[i+6],benchInputs[i+7]);
  checksumSink+=checksum;return{elapsedMs:performance.now()-start,checksum};
}
function scalarWasm(passes){
  let checksum=0;const start=performance.now();
  for(let repeat=0;repeat<passes;repeat++)for(let i=0;i<benchInputs.length;i+=8)checksum+=scalar(benchInputs[i],benchInputs[i+1],benchInputs[i+2],benchInputs[i+3],benchInputs[i+4],benchInputs[i+5],benchInputs[i+6],benchInputs[i+7]);
  checksumSink+=checksum;return{elapsedMs:performance.now()-start,checksum};
}
const quantile=(values,q)=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor(q*sorted.length))];};
const summarize=values=>({min:Math.min(...values),median:quantile(values,.5),p90:quantile(values,.9),max:Math.max(...values),samples:values});
function compare(label,count,runJS,runWasm){
  for(let warm=0;warm<6;warm++){runJS(32);runWasm(32);}
  let passes=1;
  while(passes<1048576){const a=runJS(passes),b=runWasm(passes);assert.equal(a.checksum,b.checksum);if(Math.min(a.elapsedMs,b.elapsedMs)>=12)break;passes*=2;}
  const js=[],wasm=[];
  for(let repeat=0;repeat<15;repeat++){
    let a,b;
    if(repeat%2===0){a=runJS(passes);b=runWasm(passes);}else{b=runWasm(passes);a=runJS(passes);}
    assert.equal(a.checksum,b.checksum,`${label} checksum`);js.push(a.elapsedMs*1e6/(passes*benchRows));wasm.push(b.elapsedMs*1e6/(passes*benchRows));
  }
  const result={label,batchSize:count,passesPerSample:passes,rowsPerSample:passes*benchRows,boundaryCallsPerWasmSample:passes*benchRows/count,unit:'nanoseconds per row, including loop and checksum work',js:summarize(js),wasm:summarize(wasm),medianSpeedupJsOverWasm:quantile(js,.5)/quantile(wasm,.5)};
  console.log(JSON.stringify({label,jsMedianNs:result.js.median,wasmMedianNs:result.wasm.median,medianSpeedupJsOverWasm:result.medianSpeedupJsOverWasm}));return result;
}
const timing=[compare('scalar eight-f64 JS/Wasm boundary',1,scalarJS,scalarWasm)];
for(const count of [1,16,128,1024]){
  const output=outputArrays.get(count),inputBlocks=Array.from({length:benchRows/count},(_,i)=>benchInputs.subarray(i*count*8,(i+1)*count*8)),wasmInput=memoryInputs.subarray(0,count*8),wasmOutput=memoryOutputs.subarray(0,count);
  const runJS=passes=>{let checksum=0;const start=performance.now();for(let repeat=0;repeat<passes;repeat++)for(const input of inputBlocks){for(let row=0;row<count;row++){const i=row*8;output[row]=projectedAirAcceleration(input[i],input[i+1],input[i+2],input[i+3],input[i+4],input[i+5],input[i+6],input[i+7]);}for(let i=0;i<count;i++)checksum+=output[i];}checksumSink+=checksum;return{elapsedMs:performance.now()-start,checksum};};
  const runWasm=passes=>{let checksum=0;const start=performance.now();for(let repeat=0;repeat<passes;repeat++)for(const input of inputBlocks){wasmInput.set(input);batch(inputPtr,count,outputPtr);output.set(wasmOutput);for(let i=0;i<count;i++)checksum+=output[i];}checksumSink+=checksum;return{elapsedMs:performance.now()-start,checksum};};
  timing.push(compare('packed batch including input and output copies',count,runJS,runWasm));
}
assert.equal(hash(await readFile(sourcePath,'utf8')),hash(sourceBefore),'Movement source changed during capture');
assert.equal(hash(await readFile(fileURLToPath(import.meta.url),'utf8')),hash(scriptBefore),'Benchmark source changed during capture');
const installedTools=Object.fromEntries(['rustc','cargo','clang','wasm-opt'].map(tool=>{const r=spawnSync('sh',['-c',`command -v ${tool}`],{encoding:'utf8'});return[tool,r.status===0?r.stdout.trim():null];}));
const report={schema:1,date:new Date().toISOString(),decision:'Retain TypeScript; no demonstrated whole-engine benefit',runtime:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length},provenance:{script:'scripts/benchmark-wasm-evaluation.mjs',scriptSha256:hash(scriptBefore),movementSource:'src/engine/movement/MovementSolvers.ts',movementSourceSha256:hash(sourceBefore),moduleOrigin:'Original module hand-encoded in this script; validated and compiled by the WebAssembly JavaScript API',moduleBytes:moduleBytes.length,moduleSha256:hash(moduleBytes),installedTools,rustCompiled:false,rustMeasured:false},method:{expression:'current=vx*wishX+vz*wishZ; requested=(airAccel*wishSpeed)*dt; Math.min(requested,Math.max(0,wishLimit-current))',engineArithmetic:'Exact arithmetic and multiplication order from the projection increment in solveAirMovement. Wish-limit/profile selection, velocity application, speed caps and output acceleration are outside this isolated kernel.',data:'Eight packed f64 values per row; seeded finite corpus plus signed-zero, exact-boundary and finite-magnitude edge cases',parity:'Object.is for every scalar and batch result, preserving signed zero; inputs checked unchanged; zero-count batch checked',performance:'1024 seeded rows; warmup; shared power-of-two pass calibration to at least 12 ms for both candidates; fifteen samples with alternating JS/Wasm order; exact checksums; no wall-time CI gate',batchCopies:'Each timed Wasm batch includes 64 bytes per row copied into linear memory, one boundary call, 8 bytes per row copied back to a JavaScript Float64Array, and the same output checksum loop used by JS. Typed-array views and memory allocation are outside timing.',limitations:['Favorable Wasm lower bound: inputs are already packed; extracting existing Velocity/Vector3 objects, material/profile resolution, packing and application to engine objects are not modeled.','Only an isolated arithmetic scalar and boundary/copies are measured. No collision, AI, replay, audio, rendering, complete movement update or Simulation.step port is benchmarked.','Rust and a Rust-generated module are unmeasured; there is no installed Rust/Cargo/Clang/Wasm optimizer toolchain.','Node/V8 on this shared executor is the only measured runtime. Browser, office-PC, gaming-PC, whole-engine FPS and physical input latency are unmeasured.']},parity,timing,checksumSink};
const jsonOutput=path.resolve(arg('--out-json')??path.join(root,'docs/physics-materials/WASM_EVALUATION.json')),mdOutput=path.resolve(arg('--out-md')??path.join(root,'docs/physics-materials/WASM_EVALUATION.md'));
const lines=['# Bounded JavaScript/WebAssembly evaluation','',`Captured ${report.date} with ${process.version} on ${report.runtime.cpu}.`, '','Retain TypeScript for this patch. This experiment measures a real WebAssembly boundary and copies, but does not demonstrate an end-to-end engine benefit. Rust was not compiled or measured.','',`The original ${moduleBytes.length}-byte module is hand-encoded in [the evaluation script](../../scripts/benchmark-wasm-evaluation.mjs), validated with WebAssembly.validate, and compiled by the JavaScript engine. No external compiler, dependency, or generated Rust artifact is used. The scalar export takes eight f64 arguments and returns one f64; the batch export reads the same eight doubles per row in linear memory and calls that kernel.`, '', '## Arithmetic and parity','', '`current = vx*wishX + vz*wishZ; requested = (airAccel*wishSpeed)*dt; Math.min(requested, Math.max(0, wishLimit-current))`','', 'Both implementations preserve the exact arithmetic and multiplication order of the projection increment in current `solveAirMovement`. Wish-limit/profile selection, application to velocity, speed caps and output acceleration are outside this isolated increment kernel; this capture does not certify parity for a complete solver port.', '',`${parity.finiteInputRows.toLocaleString('en-US')} finite-input rows (${parity.seededRows.toLocaleString('en-US')} seeded and ${parity.edgeRows} edge rows) pass exact Object.is checks: ${parity.scalarComparisons.toLocaleString('en-US')} scalar comparisons plus ${parity.batchComparisons.toLocaleString('en-US')} batch comparisons, with zero mismatches. This includes ${parity.negativeZeroResults} negative-zero and ${parity.positiveZeroResults.toLocaleString('en-US')} positive-zero outputs, unchanged input bytes, and a zero-count batch.`, '', '## Boundary and copy timings','', 'Times are nanoseconds per input row; smaller is faster. Every case uses the same 1024 seeded rows, calibrated repeated passes, warmup, fifteen alternating samples, and matching exact checksums. Values are medians; the JSON retains min, p90, max and all fifteen samples. Speedup is JS median divided by Wasm median; a value below 1 means Wasm is slower.', '', '| Case | Rows per Wasm call | JS median (ns) | Wasm median (ns) | JS/Wasm ratio |','| --- | ---: | ---: | ---: | ---: |',...timing.map(row=>`| ${row.label} | ${row.batchSize} | ${row.js.median.toFixed(2)} | ${row.wasm.median.toFixed(2)} | ${row.medianSpeedupJsOverWasm.toFixed(3)} |`), '', 'Batch timing includes the input copy into Wasm linear memory (64 bytes per row), the boundary call and kernel, the output copy back to a JavaScript Float64Array (8 bytes per row), and a checksum over every output. The JS comparison reads the same packed input, writes the same output array, and runs the same checksum. Memory allocation and typed-array view creation occur before timing.', '', '## Scope and adoption decision','', 'This is a favorable Wasm lower bound because input is already in packed Float64Arrays. Reading the existing Velocity/Vector3 objects, resolving profiles, packing values and applying outputs back to engine objects are not modeled. Kernel batching also requires independent work; the application currently steps one authoritative player movement state at a time.', '', 'These measurements do not cover collision, AI, replay, audio, rendering, a complete movement update or Simulation.step. They do not establish browser, office-PC, gaming-PC, complete-frame FPS, or physical input-latency gains. Any future adoption needs an actual engine prototype with its full data path and exact gameplay/replay parity, followed by end-to-end measurement. The measured boundary/copy result alone does not justify replacing the current TypeScript runtime.', '', 'No rustc, cargo, clang or wasm-opt is installed in this executor. Rust remains unmeasured; the JSON records tool inventory and source/module hashes.', '', '```sh','node scripts/benchmark-wasm-evaluation.mjs --parity-only','node scripts/benchmark-wasm-evaluation.mjs','```',''];
await mkdir(path.dirname(jsonOutput),{recursive:true});await mkdir(path.dirname(mdOutput),{recursive:true});
await writeFile(jsonOutput,JSON.stringify(report,null,2)+'\n');await writeFile(mdOutput,lines.join('\n'));
console.log(JSON.stringify({jsonOutput,mdOutput,parity,decision:report.decision}));
