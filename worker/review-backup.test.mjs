import assert from 'node:assert/strict';
import test from 'node:test';
import { readBackup } from '../public/review/backup.js';

const record = { id:'valoprac:session-1', when:'2026-11-22T10:12', mode:'시간제 훈련', title:'중거리 첫발',
  source:'valoprac.trade', map:'기본 사격장', weapon:'밴달', agent:'', distance:20, scene:['미드'], issues:['첫발 빗나감'],
  followUp:[], notes:'정지 확인', metrics:{first:45,accuracy:0} };
const backup = { schema:1, demo:false, records:[record], profile:{dpi:1000,sensitivity:.31,style:'한 발씩 사격'},
  goals:{'["2026-11-16","첫발 빗나감"]':4}, rules:{'첫발 빗나감':{metric:'first',mode:'시간제 훈련'}} };

test('Review Lab legacy backups restore tags, sessions, measurements and settings', () => {
  const restored = readBackup({ ...backup, records:[record,record] });
  assert.equal(restored.records.length,1);
  assert.match(restored.records[0].id,/^valoprac:/);
  assert.deepEqual(restored.records[0].issues,record.issues);
  assert.equal(restored.records[0].metrics.first,45);
  assert.equal(restored.records[0].metrics.accuracy,0);
  assert.equal(restored.records[0].metrics.rotation,null);
  assert.deepEqual(restored.profile,backup.profile);
  assert.deepEqual({ ...restored.goals },backup.goals);
  assert.deepEqual(restored.rules,backup.rules);
});
test('Review Lab backup validation rejects demos and corrupt data', () => {
  assert.throws(() => readBackup({ ...backup, demo:true }));
  assert.throws(() => readBackup({ ...backup, records:[{ ...record, when:'2026-02-31T10:12' }] }));
  assert.throws(() => readBackup({ ...backup, records:[{ ...record, metrics:{first:101} }] }));
  assert.throws(() => readBackup({ ...backup, goals:{badKey:3} }));
});
