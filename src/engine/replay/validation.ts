import {DEFAULT_SETTINGS,sanitizeSettings} from '../../config/settings';
import type {Settings} from '../types';
import {validateSessionOptions} from '../../training/platform/SessionOptions';
import {isMovementAction} from '../../training/movementTools/types';
import {FIELD_CHARACTER_GEOMETRY,PREVIOUS_FIELD_GEOMETRY,TAILORED_FIELD_GEOMETRY} from '../targets/characterProfile';
import {integrityHash} from './integrity';
import {MAX_REPLAY_COMMANDS,MAX_REPLAY_SECONDS,ReplayError,type ReplayRecording} from './types';
const MODES=['free','precision','braking','spray','tracking'],WEAPONS=['rifleA','rifleB','sheriff','operator','knife'];
function fail():never{throw new ReplayError('리플레이 파일의 형식·값 또는 기록 한도가 올바르지 않습니다.');}
function obj(v:unknown):v is Record<string,unknown>{return!!v&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);}
function num(v:unknown,min=-1e12,max=1e12):v is number{return typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;}
function integer(v:unknown,min=0,max=1e12):v is number{return num(v,min,max)&&Number.isSafeInteger(v);}
function text(v:unknown,max=160):v is string{return typeof v==='string'&&v.length<=max;}
function sorted(v:unknown):unknown{return Array.isArray(v)?v.map(sorted):obj(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sorted(v[k])])):v;}
function same(a:unknown,b:unknown){return integrityHash(sorted(a))===integrityHash(sorted(b));}
function safeTree(value:unknown,depth=0){if(depth>24)fail();if(value===null||typeof value==='boolean')return;if(typeof value==='string'){if(value.length>4096)fail();return;}if(typeof value==='number'){if(!Number.isFinite(value))fail();return;}if(Array.isArray(value)){if(value.length>MAX_REPLAY_COMMANDS)fail();for(const x of value)safeTree(x,depth+1);return;}if(!obj(value))fail();for(const[k,v]of Object.entries(value)){if(['__proto__','prototype','constructor'].includes(k)||k.length>80)fail();safeTree(v,depth+1);}}
function settings(raw:unknown,partial=false){if(!obj(raw)||Object.keys(raw).some(k=>!Object.hasOwn(DEFAULT_SETTINGS,k)))fail();
 const sanitized=sanitizeSettings({...DEFAULT_SETTINGS,...raw});if(partial){for(const k of Object.keys(raw))if(!same(raw[k],(sanitized as unknown as Record<string,unknown>)[k]))fail();}else if(!same(raw,sanitized))fail();
}
export function validateReplay(value:unknown):asserts value is ReplayRecording {
 if(!obj(value)||value.schema!==1)fail();safeTree(value);const r=value as unknown as ReplayRecording,h=r.header;
 if(!obj(h)||!text(h.gameVersion,40)||!text(h.simulationVersion,80)||!text(h.movementVersion,80)||!text(h.projectionVersion,80)||!text(h.calibrationFingerprint,32)||!integer(h.createdAt,0,Number.MAX_SAFE_INTEGER)||h.fixedHz!==120||!text(h.map,40)||!text(h.physics,80)||!integer(h.seed,1,2147483647)||!obj(h.initial)||!MODES.includes(h.initial.mode)||!WEAPONS.includes(h.initial.weapon)||typeof h.initial.attached!=='boolean')fail();settings(h.initial.settings);
 if(h.simulationRules!==undefined&&!['legacy-v2','materials-v3','air-steering-v4','bunny-hop-v5'].includes(h.simulationRules)||h.materialPhysicsVersion!==undefined&&!text(h.materialPhysicsVersion,80)||h.inputVersion!==undefined&&!text(h.inputVersion,80)||h.weaponVersion!==undefined&&!text(h.weaponVersion,80))fail();
 if(h.characterGeometryVersion!==undefined&&h.characterGeometryVersion!==FIELD_CHARACTER_GEOMETRY&&h.characterGeometryVersion!==PREVIOUS_FIELD_GEOMETRY&&h.characterGeometryVersion!==TAILORED_FIELD_GEOMETRY)fail();
 if(!obj(h.initial.options))fail();const options=validateSessionOptions(h.initial.options);if(!same(options,h.initial.options))fail();
 const initial=h.initial.settings,expectedMap=h.initial.mode==='free'?initial.practiceMap:'range',expectedPhysics=initial.movementPhysics==='counterStrike'?`counterStrike/${initial.csMovementPreset}`:'valorant';
 if(h.map!==expectedMap||h.physics!==expectedPhysics)fail();
 if(options.exercise&&(h.initial.mode!=='free'||h.map!=='range'))fail();
 if(options.scenario&&(h.initial.mode!=='free'||options.scenario.seed!==h.seed||options.scenario.template!==h.map||options.scenario.player.weapon!==h.initial.weapon))fail();
 if(h.seed!==h.initial.settings.seed||!num(r.duration,0,MAX_REPLAY_SECONDS)||!integer(r.ticks,0,MAX_REPLAY_SECONDS*120)||Math.abs(r.duration-r.ticks/120)>1e-7)fail();
 if(!Array.isArray(r.commands)||r.commands.length>MAX_REPLAY_COMMANDS||!Array.isArray(r.checkpoints)||r.checkpoints.length>MAX_REPLAY_SECONDS+1000||!Array.isArray(r.events)||r.events.length>20_000)fail();
 let steps=0,lastStamp=-Infinity,lastFrame=0;
 for(const c of r.commands){if(!Array.isArray(c)||!integer(c[0],0,12))fail();switch(c[0]){
  case 0:{if(c.length!==2||!Array.isArray(c[1])||c[1].length!==9)fail();const p=c[1];if(!num(p[0],-1,1)||!num(p[1],-1,1)||!integer(p[2],0,1023)||p[3]!==null&&!num(p[3],-1e9,1e9)||p[4]!==null&&!num(p[4],-MAX_REPLAY_SECONDS,MAX_REPLAY_SECONDS)||p.slice(5).some(n=>!integer(n,0,1024)))fail();steps++;break;}
  case 1:if(c.length!==3||!num(c[1],-1e6,1e6)||!num(c[2],-1e6,1e6))fail();break;
  case 2:if(c.length!==5||!integer(c[1],lastFrame+1)||!num(c[2],0)||c[2]<lastStamp||!num(c[3],0,1)||!integer(c[4],0,r.ticks)||c[4]!==steps)fail();lastFrame=c[1];lastStamp=c[2];break;
  case 3:if(c.length!==2||!num(c[1],0))fail();break;
  case 4:case 7:case 8:case 9:case 10:if(c.length!==1)fail();break;
  case 5:if(c.length!==2)fail();settings(c[1],true);break;
  case 6:if(c.length!==2||!WEAPONS.includes(c[1]))fail();break;
  case 11:if(c.length!==3||typeof c[1]!=='boolean'||typeof c[2]!=='boolean')fail();break;
  case 12:if(c.length!==2||!isMovementAction(c[1]))fail();break;
 }}
 if(steps!==r.ticks)fail();let command=0,tick=0;
 for(const p of r.checkpoints){if(!obj(p)||!integer(p.command,command+1,r.commands.length)||!integer(p.tick,tick,r.ticks)||!text(p.checksum,16)||!/^[0-9a-f]{16}$/.test(p.checksum))fail();command=p.command;tick=p.tick;}
 if(!r.checkpoints.length||command!==r.commands.length||tick!==r.ticks)fail();
 if(!obj(r.final)||!text(r.final.checksum,16)||!/^[0-9a-f]{16}$/.test(r.final.checksum)||!integer(r.final.score)||!integer(r.final.shots)||!integer(r.final.hits,0,r.final.shots)||!integer(r.final.deaths)||r.final.tick!==r.ticks||r.final.time!==r.duration)fail();
 for(const e of r.events)if(!obj(e)||!num(e.time,0,r.duration)||!['shot','kill','death','respawn','jump','landing','weapon','settings','movement','cue','turn'].includes(e.kind)||!text(e.label))fail();
}
export function validSettingsPatch(raw:unknown):raw is Partial<Settings>{try{safeTree(raw);settings(raw,true);return true;}catch{return false;}}
