import {readFileSync,existsSync,readdirSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('dist-client');
const read=p=>readFileSync(join(root,p),'utf8');
const release=JSON.parse(read('release.json'));
assert.equal(release.version,JSON.parse(readFileSync('package.json','utf8')).version);
assert(release.features.includes('free-practice'));
const html=read('index.html');
assert(html.includes('lang="ko"'));
assert(html.includes('VALOPRAC'));
assert(html.includes('https://valoprac.trade/'));
for(const match of html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g))assert(existsSync(join(root,match[1])),match[1]);
const manifest=JSON.parse(read('.vite/manifest.json'));
for(const value of Object.values(manifest)){assert(existsSync(join(root,value.file)),value.file);for(const css of value.css??[])assert(existsSync(join(root,css)),css);}
assert(Object.keys(manifest).some(k=>k.includes('GameStage')),'3D gameplay must be emitted as a real dynamic chunk');
for(const file of readdirSync(join(root,'assets'))){const path=join(root,'assets',file);assert(!file.endsWith('.map'),'Public sourcemaps must not be emitted');assert(statSync(path).size<2_000_000,`Unexpected large asset: ${file}`);if(file.endsWith('.js'))assert(!/sk-(?:proj-)?[A-Za-z0-9_-]{30,}/.test(readFileSync(path,'utf8')),'Potential API key in browser output');}
const tactical=JSON.parse(read('tactical-validation.json'));assert.equal(tactical.release,release.version);assert.equal(tactical.ads.length,2);assert(tactical.ads.every(x=>x.blocked===0));assert(read('tactical-guide.html').includes('톡브레이킹 순서'));
assert(read('guide.html').includes('자체 제작 대체음'));
assert(read('footsteps.html').includes('누적'));
assert(read('aim-methodology.html').includes('실제 참가자의 향상 효과는 미검증'));
const aim=JSON.parse(read('aim-validation.json'));assert.equal(aim.release,release.version);assert(aim.tests.passed);assert.equal(aim.humanEvidence.participants,0);assert.equal(aim.humanEvidence.humanEffectivenessVerified,false);assert(Object.keys(manifest).some(k=>k.includes('AimDashboard')),'Aim science must be a lazy connected module');
assert(readdirSync(join(root,'assets')).some(f=>f.includes('analysis.worker')),'Completed trajectory analysis needs its worker chunk');
assert.equal(JSON.parse(read('footstep-calibration.json')).actualValorantMeasured,false);
assert(read('_headers').includes('immutable'));
assert(read('_redirects').includes('/index.html 200'));
for(const route of ['training','settings','statistics','results','weapons','unreal','aim'])assert.equal(read(`${route}/index.html`),html);
assert(existsSync(join(root,'downloads/valoprac-unreal-source.zip')));
assert(Object.keys(manifest).some(k=>k.includes('EpicSession')),'Official streaming client must remain lazy loaded');
assert.equal(JSON.parse(read('streaming-config.json')).enabled,release.unreal.productionEnabled,'Release metadata must match the actual streaming configuration');
console.log(JSON.stringify({release:release.version,manifestEntries:Object.keys(manifest).length,assetCount:readdirSync(join(root,'assets')).length,passed:true}));

const precision=JSON.parse(read('precision-validation.json'));assert.equal(precision.release,release.version);assert.equal(precision.algorithm,'aim-2.0.0');assert.equal(precision.optimizer.humanParticipants,0);assert.equal(precision.optimizer.profiles,9);assert.equal(precision.optimizer.methods.length,4);assert.equal(precision.tests.passed,true);assert(Object.keys(manifest).some(k=>k.includes('TacticalAssessment')),'Real FPS calibration must load on demand');
