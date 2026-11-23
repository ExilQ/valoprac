import {describe,expect,it} from 'vitest';
import legacyFixture from './fixtures/replay-10.0.0.json';
import {readReplayFile} from '../ui/ReplayViewer';
import {encodeReplay} from '../engine/replay/codec';
import {ReplayPlayer} from '../engine/replay/playback';
import type {ReplayRecording} from '../engine/replay/types';

const file=async(recording:ReplayRecording)=>{
 const bytes=await encodeReplay(recording);
 return{size:bytes.length,arrayBuffer:async()=>Uint8Array.from(bytes).buffer};
};

describe('Replay file import shares the versioned playback compatibility registry',()=>{
 it('imports the independently recorded legacy file without changing its identity or outcomes',async()=>{
  const recording=structuredClone(legacyFixture) as ReplayRecording,before=JSON.stringify(recording);
  const imported=await readReplayFile(await file(recording));
  expect(imported).toEqual(recording);
  const player=new ReplayPlayer(imported);
  expect(player.simulation.rules).toBe('legacy-v2');
  const verified=await player.verify();
  expect(verified.passed).toBe(true);
  expect(verified.checksum).toBe(recording.final.checksum);
  expect(JSON.stringify(recording)).toBe(before);
 });
 it('rejects mixed historical and current mechanics metadata at the import boundary',async()=>{
  const recording=structuredClone(legacyFixture) as ReplayRecording;
  recording.header.simulationRules='materials-v3';
  await expect(readReplayFile(await file(recording))).rejects.toThrow('호환되지 않는');
 });
 it('rejects an altered historical calibration fingerprint rather than silently using current rules',async()=>{
  const recording=structuredClone(legacyFixture) as ReplayRecording;
  recording.header.calibrationFingerprint='0000000000000000';
  await expect(readReplayFile(await file(recording))).rejects.toThrow('호환되지 않는');
 });
});
