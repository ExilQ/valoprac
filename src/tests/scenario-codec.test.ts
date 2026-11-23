import {describe,it,expect} from 'vitest';
import {createScenario} from '../training/scenarios/templates';
import {SCENARIO_ROUTE_IDS,MAX_SCENARIO_BYTES,SCENARIO_CODE_PREFIX} from '../training/scenarios/types';
import {encodeScenario,decodeScenario,scenarioURL,scenarioCodeFromURL,MAX_SCENARIO_CODE_LENGTH} from '../training/scenarios/codec';

const rawCode=(raw:unknown)=>SCENARIO_CODE_PREFIX+Buffer.from(JSON.stringify(raw),'utf8').toString('base64url');
describe('A5 scenario codes are bounded versioned data, not programs',()=>{
 for(const route of SCENARIO_ROUTE_IDS)it(`${route}: preserves the equivalent original route and rules`,()=>{
  const source=createScenario(route),code=encodeScenario(source),decoded=decodeScenario(code);
  expect(code.startsWith('VP-S1.')).toBe(true);expect(code.length).toBeLessThanOrEqual(MAX_SCENARIO_CODE_LENGTH);expect(decoded).toEqual(source);expect(encodeScenario(decoded)).toBe(code);
  decoded.bots[0].position.x+=.1;expect(source.bots[0].position.x).not.toBe(decoded.bots[0].position.x);
 });
 it('preserves Korean UTF-8 text and permits surrounding pasted whitespace',()=>{
  const source=createScenario('long-lane');source.title='머리 높이 · 가까운 각';const code=encodeScenario(source);expect(decodeScenario('\n '+code+' \n').title).toBe(source.title);
 });
 it('rejects empty, wrong-version, padded, noncanonical and corrupted encodings',()=>{
  const code=encodeScenario(createScenario('long-lane'));
  for(const bad of [null,{},'', 'VP-S2.'+code.slice(6),'VP-S1.A', 'VP-S1.AB','VP-S1.%%%%',code+'=',code+';',code.slice(0,15)+' '+code.slice(15)])expect(()=>decodeScenario(bad)).toThrow();
 });
 it('rejects oversize encoded data before accepting a scenario tree',()=>{
  expect(()=>decodeScenario('VP-S1.'+'A'.repeat(MAX_SCENARIO_CODE_LENGTH))).toThrow();
  const payload=SCENARIO_CODE_PREFIX+Buffer.alloc(MAX_SCENARIO_BYTES+1,32).toString('base64url');expect(()=>decodeScenario(payload)).toThrow();
 });
 it('rejects malformed UTF-8 and executable or unknown schema payloads',()=>{
  for(const bytes of [Uint8Array.of(0xc3,0x28),new TextEncoder().encode('<script>alert(1)</script>')])expect(()=>decodeScenario(SCENARIO_CODE_PREFIX+Buffer.from(bytes).toString('base64url'))).toThrow();
  const source=createScenario('long-lane');expect(()=>decodeScenario(rawCode({...source,schema:9}))).toThrow();expect(()=>decodeScenario(rawCode({...source,script:'eval(1)'}))).toThrow();
 });
 it('rejects dangerous prototype keys without modifying Object.prototype',()=>{
  const source=createScenario('long-lane'),raw=JSON.stringify(source).replace('"schema":1','"schema":1,"__proto__":{"scenarioPolluted":true}');
  expect(()=>decodeScenario(SCENARIO_CODE_PREFIX+Buffer.from(raw).toString('base64url'))).toThrow();expect(({} as {scenarioPolluted?:boolean}).scenarioPolluted).toBeUndefined();
 });
 it('does not allow a JSON control character or a forged bot/weapon shape',()=>{
  const source=createScenario('long-lane');const control=JSON.stringify(source).replace(source.title,'bad\u0000title');
  expect(()=>decodeScenario(SCENARIO_CODE_PREFIX+Buffer.from(control).toString('base64url'))).toThrow();
  expect(()=>decodeScenario(rawCode({...source,bots:[{...source.bots[0],weapon:'executable'}]}))).toThrow();
 });
});

describe('A5 optional shared URLs contain local data only',()=>{
 it('opens the actual tools entry by default while keeping the payload out of HTTP queries',()=>{
  const source=createScenario('long-lane'),url=new URL(scenarioURL(source));expect(url.origin).toBe('https://valoprac.trade');expect(url.pathname).toBe('/tools.html');expect(url.search).toBe('');expect(scenarioCodeFromURL(url.toString())).toBe(encodeScenario(source));
 });
 it('uses a fragment and reproduces the same canonical scenario without a request',()=>{
  const source=createScenario('sequential'),url=new URL(scenarioURL(source,'https://valoprac.trade/?tracking=discarded#old'));
  expect(url.protocol).toBe('https:');expect(url.search).toBe('');expect(url.hash).toMatch(/^#scenario=/);expect(scenarioCodeFromURL(url.toString())).toBe(encodeScenario(source));
 });
 it('supports an explicit single query code and treats ordinary addresses as absent',()=>{
  const code=encodeScenario(createScenario('close-corner'));expect(scenarioCodeFromURL('https://valoprac.trade/?scenario='+code)).toBe(code);expect(scenarioCodeFromURL('https://valoprac.trade/#tools')).toBeNull();
 });
 it('rejects duplicate, ambiguous, credential-bearing and executable URLs',()=>{
  const code=encodeScenario(createScenario('off-angle'));
  for(const url of ['javascript:alert(1)','data:text/plain,foo','https://user:pass@valoprac.trade/','https://valoprac.trade/?scenario='+code+'&scenario='+code,'https://valoprac.trade/?scenario='+code+'#scenario='+code])expect(()=>scenarioCodeFromURL(url)).toThrow();
 });
});
