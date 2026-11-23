import {describe,it,expect,vi} from 'vitest';
import {Children,isValidElement,type ReactNode} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {writeFileSync} from 'node:fs';
import {DEFAULT_SETTINGS} from '../config/settings';
import type {SessionData,ShotEvent} from '../engine/types';
import {summarize} from '../training/analytics/statistics';
import {sessionHighlights,highlightTime,highlightMetric,MAX_SESSION_HIGHLIGHTS} from '../training/analytics/highlights';
import {SessionHighlights} from '../ui/SessionHighlights';
import {ResultDetails} from '../ui/Results';

function shot(timestamp:number,patch:Partial<ShotEvent>={}):ShotEvent{return{timestamp,weapon:'rifleA',shotIndex:0,magazineShot:0,firstShot:false,position:{x:0,y:0,z:0},velocity:{x:0,y:0,z:0},direction:{x:0,y:0,z:-1},aim:{yaw:0,pitch:0},recoil:{yaw:0,pitch:0},spread:{base:.25,movement:0,bloom:0,air:0,total:.25,x:0,y:0},hit:'head',impact:{x:0,y:1.68,z:-20},targetId:0,targetPosition:{x:0,y:0,z:-20},targetState:'stationary',targetGeneration:1,playerCompensation:{yaw:0,pitch:0},accurate:true,releaseTime:null,thresholdDelta:null,brakingKind:null,initialSpeed:null,brakingDuration:null,decelerationDuration:null,movementDirection:{x:0,z:0},angularError:null,...patch};}
function fixture(patch:Partial<SessionData>={}):SessionData{const tracking={samples:0,onHead:0,errorSquared:0};return{id:'highlight-fixture',createdAt:0,mode:'precision',weapon:'rifleA',duration:12,seed:123,settings:{...DEFAULT_SETTINGS},shots:[],kills:[],reactions:[],tracking,summary:summarize([],[],[],tracking),...patch};}
function rich(){return fixture({shots:[shot(.5,{firstShot:true,angularError:.5}),shot(1,{hit:'miss',firstShot:true,angularError:8}),shot(1.2,{hit:'wall'}),shot(1.4,{hit:'miss'}),shot(2),shot(3,{firstShot:true,angularError:2,brakingKind:'opposite',releaseTime:2.8,initialSpeed:4,thresholdDelta:.01,brakingDuration:.19}),shot(4,{firstShot:true,hit:'miss',angularError:12}),shot(4.2)],kills:[{timestamp:.5,targetId:0,generation:1,elapsed:.3,firstShot:true},{timestamp:2,targetId:1,generation:1,elapsed:1.8,firstShot:false},{timestamp:4.2,targetId:2,generation:1,elapsed:.4,firstShot:false}],reactions:[{targetId:0,changeTime:4,latency:.2},{targetId:1,changeTime:5,latency:.4}],tactical:{clears:2,deaths:1,maxExposure:1.1,lastDeath:{bot:0,angle:'test',duration:1.1,time:10,player:{x:0,y:0,z:0},defender:{x:0,y:0,z:-20}}}});}

describe('I9 deterministic event highlights',()=>{
 it('selects five real bounded moments with reasons and chronological replay positions',()=>{
  const session=rich(),before=structuredClone(session),moments=sessionHighlights(session);
  expect(moments.map(m=>m.type)).toEqual(['longest-miss-streak','slowest-elimination','best-braking-shot','fastest-reacquisition','death-exposure']);
  expect(moments.map(m=>m.timestamp)).toEqual([1,2,3,4.2,10]);expect(moments.map(m=>m.metric)).toEqual([3,1.8,.01,.2,1.1]);
  expect(moments[0].endTimestamp).toBe(1.4);expect(new Set(moments.map(m=>m.id)).size).toBe(5);
  for(const m of moments){expect(m.timestamp).toBeGreaterThanOrEqual(0);expect(m.timestamp).toBeLessThanOrEqual(session.duration);expect(m.reason.length).toBeGreaterThan(10);expect(m.reason.length).toBeLessThan(200);expect(Number.isFinite(m.metric)).toBe(true);}
  expect(sessionHighlights(session)).toEqual(moments);expect(session).toEqual(before);
 });
 it('does not invent an initial mouse-flick error from a spread-affected bullet ray',()=>{
  const session=rich();session.kills=[];session.reactions=[];session.tactical=undefined;
  const moment=sessionHighlights(session).find(m=>m.type==='largest-first-shot-error')!;
  expect(moment.timestamp).toBe(4);expect(moment.metric).toBe(12);expect(moment.reason).toContain('반동·산포');expect(moment.reason).toContain('순수 마우스 플릭 오차는 아닙니다');
  const fast=sessionHighlights(fixture({kills:[{timestamp:1,targetId:0,generation:1,elapsed:.25,firstShot:true}]}));expect(fast).toHaveLength(1);expect(fast[0].type).toBe('fastest-elimination');
 });
 it('omits wall-analysis miss/flick judgments and preserves a measured brake example',()=>{
  const session=rich();session.mode='spray';session.reactions=[];session.kills=[];session.tactical=undefined;
  expect(sessionHighlights(session).map(m=>m.type)).toEqual(['best-braking-shot']);session.mode='free';session.settings.analysisWall=true;expect(sessionHighlights(session).map(m=>m.type)).toEqual(['best-braking-shot']);
 });
 it('rejects missing, non-finite, future and physically impossible timing rather than clamping it',()=>{
  const session=fixture({shots:[shot(-1,{firstShot:true,angularError:4}),shot(15,{firstShot:true,angularError:4}),shot(2,{firstShot:true,angularError:Infinity}),shot(3,{brakingKind:'opposite',releaseTime:4,initialSpeed:4,thresholdDelta:0})],kills:[{timestamp:13,targetId:0,generation:1,elapsed:1,firstShot:true},{timestamp:1,targetId:0,generation:1,elapsed:2,firstShot:true}],reactions:[{targetId:0,changeTime:11.9,latency:.2},{targetId:1,changeTime:2,latency:NaN}],tactical:{clears:0,deaths:1,maxExposure:1,lastDeath:{bot:0,angle:'bad',duration:2,time:1,player:{x:0,y:0,z:0},defender:{x:0,y:0,z:0}}}});
  expect(sessionHighlights(session)).toEqual([]);for(const duration of[0,-1,NaN,Infinity])expect(sessionHighlights({...rich(),duration})).toEqual([]);
  expect(sessionHighlights({...fixture(),shots:[null,undefined] as unknown as ShotEvent[],kills:[null] as unknown as SessionData['kills'],reactions:[null] as unknown as SessionData['reactions']})).toEqual([]);
 });
 it('breaks miss sequences across death generations, invalid records and reversed timestamps',()=>{
  const samples=[shot(1,{hit:'miss',lifeGeneration:1}),shot(2,{hit:'miss',lifeGeneration:1}),shot(3,{hit:'miss',lifeGeneration:2}),shot(4,{hit:'miss',lifeGeneration:2}),shot(NaN,{hit:'miss',lifeGeneration:2}),shot(6,{hit:'miss',lifeGeneration:2}),shot(5,{hit:'miss',lifeGeneration:2}),shot(7,{hit:'miss',lifeGeneration:2})];
  const moments=sessionHighlights(fixture({shots:samples}));expect(moments).toHaveLength(1);expect(moments[0]).toMatchObject({type:'longest-miss-streak',timestamp:1,endTimestamp:2,metric:2});
 });
 it('bounds event scans and requested output count without borrowing stripped historical summaries',()=>{
  const session=fixture({duration:6000,shots:Array.from({length:5000},(_,i)=>shot(i+1,{hit:'miss'}))});expect(sessionHighlights(session)[0]).toMatchObject({metric:4096,timestamp:905});
  expect(sessionHighlights(rich(),999)).toHaveLength(MAX_SESSION_HIGHLIGHTS);expect(sessionHighlights(rich(),2)).toHaveLength(2);expect(sessionHighlights(rich(),0)).toEqual([]);expect(sessionHighlights(rich(),-1)).toEqual([]);
  const empty=fixture();empty.summary.shots=999;empty.summary.eliminations=50;expect(sessionHighlights(empty)).toEqual([]);
 });
 it('breaks metric ties deterministically and formats real units including a minute boundary',()=>{
  const s=fixture({kills:[{timestamp:4,targetId:0,generation:1,elapsed:.5,firstShot:true},{timestamp:2,targetId:1,generation:1,elapsed:.5,firstShot:true}]});expect(sessionHighlights(s)).toHaveLength(1);expect(sessionHighlights(s)[0].timestamp).toBe(2);
  expect(highlightTime(59.96)).toBe('01:00.0');expect(highlightTime(65.25)).toBe('01:05.3');expect(highlightMetric({metric:.22,unit:'seconds'})).toBe('220.0ms');expect(highlightMetric({metric:3,unit:'shots'})).toBe('3발');expect(highlightMetric({metric:2.345,unit:'degrees'})).toBe('2.35°');
 });
});

describe('I9 compact result integration and future replay callback',()=>{
 it('shows real labels and values, no fake controls without a replay, and no empty cards',()=>{
  const session=rich(),html=renderToStaticMarkup(<SessionHighlights session={session}/>);expect((html.match(/<li>/g)??[])).toHaveLength(5);expect(html).toContain('다시 볼 순간');expect(html).toContain('00:01.0');expect(html).toContain('3발');expect(html).not.toContain('<button');expect(html).not.toContain('NaN');
  if(process.env.VALOPRAC_HIGHLIGHT_FIXTURE)writeFileSync(process.env.VALOPRAC_HIGHLIGHT_FIXTURE,JSON.stringify(session));
  if(process.env.VALOPRAC_HIGHLIGHT_HTML)writeFileSync(process.env.VALOPRAC_HIGHLIGHT_HTML,JSON.stringify({normal:html,withSeeking:renderToStaticMarkup(<SessionHighlights session={session} onSeek={()=>{}}/>)}));
  expect(renderToStaticMarkup(<SessionHighlights session={fixture()}/>)).toBe('');expect(renderToStaticMarkup(<ResultDetails session={session}/>)).toContain('session-highlights');
 });
 it('only passes an existing selected event and exact simulation timestamp to a supplied viewer',()=>{
  const seek=vi.fn(),element=SessionHighlights({session:rich(),onSeek:seek}),buttons:{onClick:()=>void}[]=[];
  const visit=(node:ReactNode)=>{Children.forEach(node,child=>{if(!isValidElement<{children?:ReactNode;onClick?:()=>void}>(child))return;if(child.type==='button'&&child.props.onClick)buttons.push(child.props as {onClick:()=>void});visit(child.props.children);});};visit(element);expect(buttons).toHaveLength(5);buttons[0].onClick();expect(seek).toHaveBeenCalledWith(1,expect.objectContaining({type:'longest-miss-streak',metric:3}));
 });
});
