import {beforeEach,describe,expect,it,vi} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {Simulation} from '../engine/simulation/Simulation';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput,type SessionData} from '../engine/types';

function session(id:string,createdAt:number):SessionData{
 const sim=new Simulation('precision','rifleA',structuredClone(DEFAULT_SETTINGS));sim.running=true;
 for(let i=0;i<60;i++)sim.step(1/120,{...emptyInput(),fire:true});
 return{...sim.snapshot(),id,createdAt};
}
beforeEach(()=>{vi.resetModules();vi.stubGlobal('indexedDB',new IDBFactory());});

describe('Training history writes are atomic across overlapping callers',()=>{
 it('enforces both retention limits when many completed sessions arrive concurrently',async()=>{
  const history=await import('../storage/history');await history.clearHistory();
  const records=Array.from({length:history.MAX_SESSIONS+13},(_,i)=>session(`parallel-${i}`,i));
  await Promise.all(records.map(record=>history.saveSession(record)));
  const stored=await history.loadHistory();expect(stored).toHaveLength(history.MAX_SESSIONS);
  expect(stored.map(s=>s.id)).toEqual(records.slice(-history.MAX_SESSIONS).reverse().map(s=>s.id));
  expect(stored.slice(0,history.MAX_DETAILED_SESSIONS).every(s=>s.shots.length>0)).toBe(true);
  expect(stored.slice(history.MAX_DETAILED_SESSIONS).every(s=>!s.shots.length&&!s.kills.length&&!s.reactions.length&&!s.replay)).toBe(true);
  expect(stored.every(s=>s.summary.shots>0)).toBe(true);
 });
 it('does not resurrect an earlier pending save after the user clears history',async()=>{
  const history=await import('../storage/history');await history.clearHistory();
  const saving=history.saveSession(session('before-clear',1)),clearing=history.clearHistory();
  await Promise.all([saving,clearing]);expect(await history.loadHistory()).toEqual([]);
  const savedAfterClear=session('after-clear',2);await history.saveSession(savedAfterClear);
  expect(await history.loadHistory()).toEqual([savedAfterClear]);
 });
 it('can retry after a synchronous IndexedDB availability or security failure',async()=>{
  vi.stubGlobal('indexedDB',{open:()=>{throw new DOMException('Storage temporarily unavailable','SecurityError');}});
  const history=await import('../storage/history');await expect(history.loadHistory()).rejects.toThrow('Storage temporarily unavailable');
  vi.stubGlobal('indexedDB',new IDBFactory());const recovered=session('recovered-storage',3);
  await history.saveSession(recovered);expect(await history.loadHistory()).toEqual([recovered]);
 });
});
