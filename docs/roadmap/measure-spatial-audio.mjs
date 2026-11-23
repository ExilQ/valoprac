const{chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs');
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage();await page.route('**/__audio_measure__',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated original audio measurement</title>'}));await page.goto('http://localhost:4179/__audio_measure__');
 const rows=await page.evaluate(async()=>{
  const{TrainingAudio}=await import('/src/engine/audio/Audio.ts'),NativeOffline=window.OfflineAudioContext,rate=48000,results=[];
  const cases=[{name:'left',position:{x:-12,y:1.64,z:0}},{name:'right',position:{x:12,y:1.64,z:0}},{name:'left-turned',position:{x:-12,y:1.64,z:0},yaw:Math.PI},{name:'front',position:{x:0,y:1.64,z:-12}},{name:'rear',position:{x:0,y:1.64,z:12}},{name:'near',position:{x:0,y:1.64,z:-9}},{name:'far',position:{x:0,y:1.64,z:-36}},{name:'open-probe',position:{x:0,y:1.64,z:-12},probe:true},{name:'covered-probe',position:{x:0,y:1.64,z:-12},probe:true,covered:true}];
  for(const test of cases){
   const offline=new NativeOffline(2,rate/2,rate);
   const proxy=new Proxy(offline,{get(target,key){if(key==='state')return'running';if(key==='resume'||key==='close')return()=>Promise.resolve();const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
   window.AudioContext=function(){return proxy;};const audio=new TrainingAudio();await audio.unlock();audio.sync(0);audio.listener({x:0,y:1.64,z:0},test.yaw??0);audio.setOcclusionResolver(()=>!!test.covered);
   if(test.probe){const probe=offline.createBuffer(1,Math.round(rate*.15),rate),data=probe.getChannelData(0);for(let i=0;i<data.length;i++){const t=i/rate,envelope=Math.min(1,t/.005,Math.max(0,(.15-t)/.005));data[i]=envelope*.12*(Math.sin(2*Math.PI*500*t)+Math.sin(2*Math.PI*4000*t));}audio.stepBuffers.set('concrete',[probe,probe]);}
   audio.botFootstep(1,{id:1,timestamp:.02,position:test.position,radius:20,speed:3.5,material:'concrete'});
   const buffer=await offline.startRendering(),channels=[buffer.getChannelData(0),buffer.getChannelData(1)];
   const rms=channels.map(data=>Math.sqrt(data.reduce((sum,v)=>sum+v*v,0)/data.length));
   const power=frequency=>channels.reduce((sum,data)=>{let re=0,im=0;for(let i=0;i<data.length;i++){re+=data[i]*Math.cos(2*Math.PI*frequency*i/rate);im+=data[i]*Math.sin(2*Math.PI*frequency*i/rate);}return sum+re*re+im*im;},0);
   results.push({name:test.name,position:test.position,yaw:test.yaw??0,originalFootstep:!test.probe,occluded:!!test.covered,rmsLeft:rms[0],rmsRight:rms[1],rmsCombined:Math.hypot(...rms),power500:power(500),power4000:power(4000),backend:audio.spatialBackend});audio.dispose();
  }
  return results;
 });
 const row=name=>rows.find(r=>r.name===name),distanceRatio=row('far').rmsCombined/row('near').rmsCombined,coveredHighRatio=(row('covered-probe').power4000/row('covered-probe').power500)/(row('open-probe').power4000/row('open-probe').power500);
 const checks={leftDominates:row('left').rmsLeft>row('left').rmsRight*1.2,rightDominates:row('right').rmsRight>row('right').rmsLeft*1.2,listenerTurnReverses:row('left-turned').rmsRight>row('left-turned').rmsLeft*1.2,distanceRatio,toleranceDistance:.015,distancePass:Math.abs(distanceRatio-.25)<.015,coveredQuieter:row('covered-probe').rmsCombined<row('open-probe').rmsCombined*.5,coveredHighRatio,coveredHighPass:coveredHighRatio<.2,allNativeHrtf:rows.every(r=>r.backend==='hrtf')};
 const report={issues:['I1','I2'],environment:'Native Chromium OfflineAudioContext,HRTFPannerNode,48kHz,0.5s windows; original concretebotfootsteps except labeled500/4000Hzocclusionprobes',rows,checks,passed:checks.leftDominates&&checks.rightDominates&&checks.listenerTurnReverses&&checks.distancePass&&checks.coveredQuieter&&checks.coveredHighPass&&checks.allNativeHrtf,geometryResolverMeasured:false,headphoneLocalizationTested:false,laptopListeningTested:false,physicalDeviceLatencyMeasured:false,completedAt:new Date().toISOString()};
 await writeFile(process.argv[2]??'docs/roadmap/STAGE2_AUDIO_SPATIAL.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
}finally{await browser.close();}
