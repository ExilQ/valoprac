// Dev-only: render the first-person knife for each design and swing phase.
// Open /dev/knife-preview.html and call knifePreview.show({skin,kind,phase}).
import {Simulation} from '../engine/simulation/Simulation';
import {RangeRenderer} from '../engine/rendering/RangeRenderer';
import {DEFAULT_SETTINGS,GRAPHICS_PRESETS} from '../config/settings';
import {emptyInput,type KnifeSkinId,type Settings} from '../engine/types';
import {equipKnifeSkin} from '../config/weaponFinishes';
import {KNIFE_SWING_SECONDS} from '../engine/rendering/KnifeView';
const host=document.getElementById('stage')!,status=document.getElementById('status')!;
let renderer:RangeRenderer|null=null,sim:Simulation|null=null;
(window as unknown as {knifePreview:unknown}).knifePreview={
 async prepare(preset:Settings['graphicsPreset']='high'){
  renderer?.dispose();const settings={...structuredClone(DEFAULT_SETTINGS),...GRAPHICS_PRESETS[preset],graphicsPreset:preset,autoGraphics:false,renderScale:1,practiceMap:'range' as const,targetCount:3,frameLimit:0,postProcessing:false,ambientOcclusion:false};
  sim=new Simulation('free','knife',settings);renderer=new RangeRenderer(host,sim,settings,{recordFrames:false});await renderer.prepare();sim.running=true;
  for(let i=0;i<120;i++)sim.step(1/120,emptyInput());status.textContent='준비 완료';return true;
 },
 show({skin,kind,phase}:{skin:KnifeSkinId;kind?:'slash'|'stab';phase?:number}){
  if(!renderer||!sim)throw Error('prepare first');equipKnifeSkin(skin);
  const r=renderer as unknown as {meleeSwing:{kind:'slash'|'stab';start:number;combo:number}|null};
  r.meleeSwing=kind?{kind,start:sim.time-(phase??0)*KNIFE_SWING_SECONDS[kind],combo:0}:null;
  renderer.render(1,1/60,false,false);status.textContent=`${skin}${kind?` · ${kind} ${phase}`:''}`;return true;
 }
};
