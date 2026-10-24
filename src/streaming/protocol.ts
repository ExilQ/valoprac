import {parseAnalytics,type AnalyticsSnapshot} from './analyticsSchema';
import type { WeaponId, Mode, Settings } from '../engine/types';
export const PROTOCOL_VERSION=1;
export type CommandKind='hello'|'configure'|'weapon'|'pause'|'resume'|'resetTargets'|'resetStats'|'finish'|'ping'|'ackEvents';
export interface EngineState {analytics?:AnalyticsSnapshot;finished?:boolean;v:1;session:string;revision:number;type:'state'|'ack'|'finished';ack?:number;weapon:WeaponId;mode:Mode;ammo:number;reserve:number;reloading:boolean;paused:boolean;time:number;shots:number;hits:number;heads:number;eliminations:number;speed:number;accurate:boolean;recoilPitch:number;recoilYaw:number;error?:string;}
export interface Command {v:1;session:string;seq:number;type:CommandKind;payload:Record<string,unknown>;}
export function parseEngineState(raw:string,session:string):EngineState|null {
 if(raw.length>65536)return null;
 try{const s=JSON.parse(raw);if(s.v!==1||s.session!==session||!['state','ack','finished'].includes(s.type)||!Number.isSafeInteger(s.revision)||s.revision<0||!['rifleA','rifleB','sheriff'].includes(s.weapon)||!['free','precision','braking','spray','tracking'].includes(s.mode))return null;
 for(const k of ['ammo','reserve','time','shots','hits','heads','eliminations','speed','recoilPitch','recoilYaw'])if(typeof s[k]!=='number'||!Number.isFinite(s[k]))return null;
 for(const k of ['reloading','paused','accurate'])if(typeof s[k]!=='boolean')return null;
 if(s.ack!==undefined&&(!Number.isSafeInteger(s.ack)||s.ack<1))return null;
 if(s.analytics!==undefined){const a=parseAnalytics(s.analytics);if(!a||a.totals.shots!==s.shots||a.totals.heads!==s.heads||a.totals.heads+a.totals.bodies+a.totals.limbs!==s.hits||a.totals.eliminations!==s.eliminations)return null;s.analytics=a;}
 if(s.finished!==undefined&&typeof s.finished!=='boolean')return null;
 return s as EngineState;}catch{return null;}
}
// Pending commands are bounded, retried with the same sequence, and acknowledged by UE.
// Firing is intentionally absent: only Epic's input channel carries shooting/mouse events.
export class ProtocolClient {
 private seq=0;private revision=-1;private pending=new Map<number,{command:Command;sent:number;attempts:number}>();
 constructor(readonly session:string,private send:(c:Command)=>void,private now:()=>number=()=>performance.now(),private acknowledged:(command:Command,state:EngineState)=>void=()=>{}){}
 command(type:CommandKind,payload:Record<string,unknown>={}){if(this.pending.size>=32)throw new Error('엔진 응답이 지연되어 명령을 보낼 수 없습니다.');const c:Command={v:1,session:this.session,seq:++this.seq,type,payload};this.pending.set(c.seq,{command:c,sent:this.now(),attempts:1});this.send(c);return c.seq;}
 receive(raw:string){const s=parseEngineState(raw,this.session);if(!s)return null;if(s.ack){const p=this.pending.get(s.ack);this.pending.delete(s.ack);if(p)this.acknowledged(p.command,s);}if(s.revision<this.revision)return null;this.revision=s.revision;return s;}
 retry(){const now=this.now();for(const p of this.pending.values())if(now-p.sent>=1500){if(p.attempts>=3)throw new Error('엔진 상태를 확인하지 못했습니다. 연결을 다시 시도하세요.');p.sent=now;p.attempts++;this.send(p.command);}}
 clear(){this.pending.clear();}
 hasPending(type:CommandKind){return [...this.pending.values()].some(p=>p.command.type===type);}
 get pendingCount(){return this.pending.size;}
}
export function settingsPayload(settings:Settings,mode:Mode){return {settings,mode};}
