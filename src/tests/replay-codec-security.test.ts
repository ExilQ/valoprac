import {describe,it,expect} from 'vitest';
import {gzipSync} from 'node:zlib';
import {Simulation} from '../engine/simulation/Simulation';
import {ReplayRecorder} from '../engine/replay/recording';
import {ReplayPlayer} from '../engine/replay/playback';
import {encodeReplay,decodeReplay} from '../engine/replay/codec';
import {validateReplay} from '../engine/replay/validation';
import {MAX_REPLAY_COMPRESSED_BYTES,MAX_REPLAY_DECOMPRESSED_BYTES} from '../engine/replay/types';
import {DEFAULT_SETTINGS} from '../config/settings';
import {emptyInput} from '../engine/types';

function recording(){const s=new Simulation('free','rifleA',structuredClone(DEFAULT_SETTINGS)),r=new ReplayRecorder(s);s.running=true;for(let n=0;n<120;n++)s.step(1/120,emptyInput());return r.finish()!;}
describe('Replay import is bounded data with compatible recomputed results',()=>{
 it('round-trips a current calendar timestamp and validates its recalculated outcome',async()=>{const r=recording();expect(r.header.createdAt).toBeGreaterThan(1e12);const v=await decodeReplay(await encodeReplay(r));expect((await new ReplayPlayer(v).verify()).passed).toBe(true);});
 it('rejects executable text, unknown commands, malformed axes and unsupported schema',async()=>{
  await expect(decodeReplay(new TextEncoder().encode('<script>alert(1)</script>'))).rejects.toThrow();
  for(const mutate of [(r:any)=>r.schema=99,(r:any)=>r.commands[0]=[99,'eval'],(r:any)=>r.commands[0]=[0,[2,0,0,null,null,0,0,0,0]],(r:any)=>r.header.initial.settings.seed=NaN]){const r=recording();mutate(r);expect(()=>validateReplay(r)).toThrow();}
 });
 it('rejects prototype keys without altering Object.prototype',async()=>{
  const r=recording() as any;r.commands[0]=[5,JSON.parse('{"__proto__":{"replayPolluted":true}}')];expect(()=>validateReplay(r)).toThrow();expect(({} as any).replayPolluted).toBeUndefined();
  await expect(decodeReplay(gzipSync(JSON.stringify(r)))).rejects.toThrow();
 });
 it('enforces compressed and streamed decompressed size limits',async()=>{
  await expect(decodeReplay(new Uint8Array(MAX_REPLAY_COMPRESSED_BYTES+1))).rejects.toThrow();
  const bomb=gzipSync(Buffer.alloc(MAX_REPLAY_DECOMPRESSED_BYTES+1,32));expect(bomb.length).toBeLessThan(MAX_REPLAY_COMPRESSED_BYTES);await expect(decodeReplay(bomb)).rejects.toThrow(/크기|한도/);
 });
 it('does not trust a changed displayed score or a different calibration version',async()=>{
  const r=recording();r.final.score++;expect((await new ReplayPlayer(r).verify()).passed).toBe(false);
  r.header.calibrationFingerprint='0000000000000000';expect(()=>new ReplayPlayer(r)).toThrow(/호환/);
 });
});
