import { readFileSync,writeFileSync,mkdirSync,rmSync } from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
const cache='.sites-runtime/unreal-export';mkdirSync(cache,{recursive:true});
async function module(path){let output=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;output=output.replace("'../simulation/random'","'./random.mjs'");const file=`${cache}/${path.split('/').at(-1).replace('.ts','.mjs')}`;writeFileSync(file,output);return import(new URL(`../${file}`,import.meta.url));}
const {WEAPONS}=await module('src/config/weapons.ts'),{MOVEMENT}=await module('src/config/movement.ts'),{createWeaponView}=await module('src/engine/rendering/WeaponView.ts');
const dir='unreal/VALOPRAC/Content/Data';mkdirSync(dir,{recursive:true});
const data={schema:1,calibration:'2.0.0',units:'meters-degrees-seconds',movement:MOVEMENT,weapons:WEAPONS};
writeFileSync(`${dir}/calibration.json`,JSON.stringify(data,null,2)+'\n');
const fields=['fireRate','adsFireRate','adsZoom','equipTime','reserve','magazine','reloadTime','firstSpread','movementSpread','airSpread','bloomPerShot','maxBloom','bloomRecovery','resetTime','recoilRecovery','recoveryDelay','cameraScale','randomness','crouchSpread','crouchRecoil','adsSpread','adsMoveModifier','yawSwitchTime','yawSwitchChance','protectedBullets'];
let header='// Generated from src/config; run npm run export:unreal. Do not edit.\n#pragma once\n#include "SimulationCore.h"\nnamespace valoprac {\ninline Profile profile(int id){Profile p;switch(id){\n';
for(const [i,w] of Object.values(WEAPONS).entries()){header+=`case ${i}:\np.semi=${w.fireMode==='semi'};\n`;for(const f of fields)header+=`p.${f}=${w[f]};\n`;header+=`p.damage={${w.damage.map(d=>`{${Number.isFinite(d.maxDistance)?d.maxDistance:-1},${d.head},${d.body},${d.leg}}`).join(',')}};\n`;header+=`p.pattern={${w.recoil.map(([x,y])=>`{${x},${y}}`).join(',')}};\nbreak;\n`;}
header+='default:break;}return p;}\ninline MovementTuning movementProfile(){MovementTuning p;\n';for(const [key,value] of Object.entries(MOVEMENT))header+=`p.${key}=${value};\n`;header+='return p;}\n}\n';writeFileSync('unreal/VALOPRAC/Source/VALOPRAC/Core/GeneratedProfiles.h',header);
const models={schema:1,license:'Original VALOPRAC geometry; no Riot assets',weapons:{}};
for(const id of Object.keys(WEAPONS)){
 const geometries=[],materials=[];const view=createWeaponView(id,g=>(geometries.push(g),g),m=>(materials.push(m),m));view.root.updateMatrixWorld(true);
 const meshes=[];view.root.traverse(obj=>{if(!obj.isMesh||obj===view.muzzle)return;
  let part='body';for(let p=obj.parent;p&&p!==view.root;p=p.parent){if(p===view.magazine)part='magazine';if(p===view.cylinder)part='cylinder';if(p===view.hammer)part='hammer';}
  const g=obj.geometry,positions=[],normals=[],uvs=[],position=g.getAttribute('position'),normal=g.getAttribute('normal'),uv=g.getAttribute('uv');const v=new THREE.Vector3(),nm=new THREE.Matrix3().getNormalMatrix(obj.matrixWorld);
  for(let i=0;i<position.count;i++){v.fromBufferAttribute(position,i).applyMatrix4(obj.matrixWorld);positions.push(...v.toArray().map(x=>+x.toFixed(6)));v.fromBufferAttribute(normal,i).applyMatrix3(nm).normalize();normals.push(...v.toArray().map(x=>+x.toFixed(5)));uvs.push(uv?.getX(i)??0,uv?.getY(i)??0);}
  const m=obj.material;meshes.push({part,positions,normals,uvs,indices:g.index?Array.from(g.index.array):Array.from({length:position.count},(_,i)=>i),color:m.color.toArray(),roughness:m.roughness,metallic:m.metalness,emissive:m.emissive.toArray()});
 });models.weapons[id]=meshes;geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}
writeFileSync(`${dir}/weapon-meshes.json`,JSON.stringify(models)+'\n');
await module('src/engine/simulation/random.ts');const {synthesize}=await module('src/engine/audio/synthesis.ts');
const audioDir='unreal/VALOPRAC/SourceAssets/Audio';mkdirSync(audioDir,{recursive:true});
for(const id of Object.keys(WEAPONS))for(const action of ['fire','reload','equip','elimination']){const samples=synthesize(id,action,48000),b=Buffer.alloc(44+samples.length*2);b.write('RIFF',0);b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(48000,24);b.writeUInt32LE(96000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples.length*2,40);for(let i=0;i<samples.length;i++)b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);writeFileSync(`${audioDir}/${id}_${action}.wav`,b);}
writeFileSync(`${dir}/audio-profiles.json`,JSON.stringify({schema:1,status:'original-substitutes',riotRecordingsIncluded:false,profiles:{rifleA:{reference:'Champions 2023 Vandal',path:'/Game/Audio/rifleA_'},rifleB:{reference:'Champions 2026 Phantom',path:'/Game/Audio/rifleB_'},sheriff:{reference:'Ion Sheriff',path:'/Game/Audio/sheriff_'}}},null,2)+'\n');
rmSync(cache,{recursive:true});console.log(`Exported ${Object.keys(WEAPONS).length} weapon profiles and original indexed meshes`);
