const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs');
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
// Run two Vite servers: frozen09.01 on4180, current source on4179.
// Set PLAYWRIGHT_MODULE when the system installation differs.
const results=[];
try{
 for(const [version,port]of[['before',4180],['after',4179]]){
  const page=await browser.newPage();await page.goto(`http://localhost:${port}/`);
  const result=await page.evaluate(async()=>{
   const{TrainingAudio}=await import('/src/engine/audio/Audio.ts');
   const NativeOffline=window.OfflineAudioContext,rate=48000,offline=new NativeOffline(2,rate,rate);
   let now=0;const starts=[];
   const proxy=new Proxy(offline,{get(target,key){if(key==='state')return'running';if(key==='currentTime')return now;if(key==='resume'||key==='close')return()=>Promise.resolve();if(key==='createBufferSource')return()=>{const source=target.createBufferSource(),start=source.start.bind(source);source.start=(time,...rest)=>{starts.push(time);return start(time,...rest);};return source;};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
   window.AudioContext=function(){return proxy;};
   const audio=new TrainingAudio();await audio.unlock();audio.sync(0);
   // A one-millisecond authored probe travels through the actual firing channel,
   // master and compressor. Short probes let offline PCM onsets be unambiguous.
   const pulse=offline.createBuffer(1,48,rate),data=pulse.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=.4;
   audio.buffers.set('rifleB:fire',pulse);
   const interval=1/11;
   audio.enemyShot('rifleB',20,0,'probe');now=.2;
   audio.enemyShot('rifleB',20,interval,'probe');audio.enemyShot('rifleB',20,2*interval,'probe');
   now=3*interval;audio.enemyShot('rifleB',20,3*interval,'probe');
   now=4*interval;audio.enemyShot('rifleB',20,4*interval,'probe');
   const rendered=await offline.startRendering(),pcm=rendered.getChannelData(0),onsets=[];
   let active=false;for(let i=0;i<pcm.length;i++){const present=Math.abs(pcm[i])>1e-5;if(present&&!active)onsets.push(i/rate);active=present;}
   const info={scheduledStarts:starts,renderedOnsets:onsets,postStallIntervals:onsets.slice(2).map((time,i)=>time-onsets[i+1]),scheduling:{...audio.scheduling},sampleRate:rate,renderedSamples:pcm.length,probe:'48-sample square pulse through original TrainingAudio firing/master/compressor; no panning for timing isolation',audioClockStallSeconds:.2};
   audio.dispose();return info;
  });results.push({version,...result});await page.close();
 }
 const after=results[1],expected=1/11,tolerance=1/48000+1e-8;
 const passed=after.renderedOnsets.length===5&&after.postStallIntervals.every(delta=>Math.abs(delta-expected)<=tolerance);
 const report={issue:'F8',environment:'Headless Chromium native OfflineAudioContext, actual TrainingAudio graph',results,expectedInterval:expected,tolerance,passed,physicalDeviceLatencyMeasured:false,headphoneListeningTested:false,completedAt:new Date().toISOString()};
 await writeFile(process.argv[2]??'docs/roadmap/STAGE1_AUDIO_ONSETS.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!passed)process.exitCode=1;
}finally{await browser.close();}
