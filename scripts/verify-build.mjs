import {readFileSync,existsSync,readdirSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
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
for(const route of ['training','settings','statistics','results','weapons','unreal','tools','maps']){
 const document=read(`${route}/index.html`);
 assert(document.includes('<meta name="robots" content="noindex,follow">'));
 assert.equal(document.replace('<meta name="robots" content="noindex,follow">','<meta name="robots" content="index,follow,max-image-preview:large">'),html,'Search exclusion must preserve the application document');
}
assert(read('aim/index.html').includes('<link rel="canonical" href="https://valoprac.trade/aim.html">'));
assert.equal(read('aim/index.html'),read('aim.html'));
assert(existsSync(join(root,'downloads/valoprac-unreal-source.zip')));
assert(Object.keys(manifest).some(k=>k.includes('EpicSession')),'Official streaming client must remain lazy loaded');
assert.equal(JSON.parse(read('streaming-config.json')).enabled,release.unreal.productionEnabled,'Release metadata must match the actual streaming configuration');
console.log(JSON.stringify({release:release.version,manifestEntries:Object.keys(manifest).length,assetCount:readdirSync(join(root,'assets')).length,passed:true}));

const precision=JSON.parse(read('precision-validation.json'));assert.equal(precision.release,release.version);assert.equal(precision.algorithm,'aim-2.0.0');assert.equal(precision.optimizer.humanParticipants,0);assert.equal(precision.optimizer.profiles,9);assert.equal(precision.optimizer.methods.length,4);assert.equal(precision.tests.passed,true);assert(Object.keys(manifest).some(k=>k.includes('TacticalAssessment')),'Real FPS calibration must load on demand');

const combat=JSON.parse(read('combat-validation.json'));assert.equal(combat.release,release.version);assert.equal(combat.tests.passed,true);assert.equal(combat.nativeParityVerified,false);assert.equal(combat.humanFairnessVerified,false);assert.equal(combat.browserQA.passed,true);assert(combat.browserQA.layouts.length>=8);assert(read('tactical-guide.html').includes('버니합 훈련'));assert(read('tactical-guide.html').includes('월샷 훈련'));
const movement=JSON.parse(read('movement-validation.json'));assert.equal(movement.release,release.version);assert.equal(movement.tests.passed,true);assert.equal(movement.browserQA.passed,true);assert.equal(movement.trustedInput.passed,true);assert.equal(movement.browserQA.layouts.length,32);assert(movement.trajectories.renderEquality.every(x=>x.equal));assert.equal(release.movement.defaultProfile,'valorant');assert.equal(movement.newMapsOrModes,0);assert(read('tactical-guide.html').includes('id="movement-09"'));assert(existsSync(join(root,'movement-trajectories.svg')));
const corrections=JSON.parse(read('corrections-validation.json'));assert.equal(corrections.release,release.version);assert.equal(corrections.browserQA.passed,true);assert.equal(corrections.browserQA.layouts.length,40);assert.equal(corrections.trustedInput.audio.passed,true);assert.equal(corrections.limits.nativeSilentJumpVerified,false);assert(read('tactical-guide.html').includes('id="corrections-0901"'));
const roadmap=JSON.parse(read('roadmap-validation.json'));assert.equal(roadmap.release,release.version);assert.equal(roadmap.patchLabel,release.patchLabel);assert(roadmap.tests.passed&&roadmap.gates.correctnessSoftwarePassed&&roadmap.gates.soundAndHardwareSoftwarePassed&&roadmap.gates.platformSoftwarePassed);assert.equal(roadmap.gates.fullPhysicalAcceptanceVerified,false);assert.equal(roadmap.stage3.sharedSimulationVersion,'valoprac-replay-simulation-3');assert(roadmap.stage3.oneMinuteReplay.verification.passed&&roadmap.stage3.oneMinuteReplay.gzipBytes<=200000);assert.equal(roadmap.stage3.browser.hudLayouts,40);assert.equal(new Set(roadmap.stage3.scenarios.map(x=>x.route)).size,5);assert.equal(roadmap.stage3.browser.exercise.passed,true);assert.equal(roadmap.limits.physicalInputLatencyVerified,false);assert.equal(roadmap.calibration.walkingRatio.changed,false);assert.equal(roadmap.calibration.walkingLanding.changed,false);assert(read('tactical-guide.html').includes('id="roadmap-10"'));for(const part of ['TrainingPlatform','ReplayViewer'])assert(Object.keys(manifest).some(k=>k.includes(part)),`${part} must remain lazy emitted code`);
const ui=JSON.parse(read('interface-validation.json'));assert.equal(ui.release,release.version);assert.equal(ui.patchLabel,release.patchLabel);assert(ui.tests.passed&&ui.responsive.allPassed&&ui.workflows.passed);assert.equal(ui.themes.default,'light');assert.equal(ui.captureRelease,'11.0.0');assert.equal(ui.preservation.captureRelease,'11.0.0');assert.equal(ui.preservation.mechanicalCompatibilityVersion,'10.0.0');assert.equal(ui.currentSimulation.gameVersion,release.version);assert.equal(ui.currentSimulation.simulationVersion,'valoprac-replay-simulation-3');assert.equal(ui.readability.failedText,0);assert(ui.readability.textMinimum>=4.5&&ui.readability.boundaryMinimum>=3);assert.equal(read('precision-tokens.css'),readFileSync('src/ui/tokens.css','utf8'));assert(read('interface-comparison.html').includes('1366'));assert(html.includes('data-theme-preference'));assert(html.includes('valoprac-interface-theme-v1'));assert(existsSync(join(root,'interface-theme.js')));assert.equal(release.interface.settingsCategories,8);
assert(!Object.keys(manifest).some(k=>k.includes('catalog.en')),'The Korean-only presentation must not download an unused English catalog');

const physics12=JSON.parse(read('physics-materials-validation.json'));assert.equal(physics12.release,release.version);assert.equal(physics12.patchLabel,release.patchLabel);assert.equal(physics12.simulation.version,'valoprac-replay-simulation-3');assert.equal(physics12.simulation.materialPhysicsVersion,'physical-surfaces-1.0.0');assert.equal(physics12.simulation.fixedHz,120);assert.equal(physics12.simulation.acceptedLegacy[0].simulationVersion,'valoprac-replay-simulation-2');assert(physics12.tests.passed&&physics12.measuredReleaseEvidence.gates.completed);assert.equal(physics12.queries.parity.mismatches,0);assert.equal(physics12.wasm.productionAdopted,false);assert.equal(physics12.limits.hardwareFPSVerified,false);assert.equal(release.physicsMaterials.visualFamilies,15);assert.equal(release.physicsMaterials.physicalSurfaces,22);assert(read('physics-materials.html').includes('12.00'));assert(read('physics-materials.html').includes('소프트웨어'));assert(!Object.keys(manifest).some(k=>k.includes('dev/materials')||k.includes('engine-audit')),'Development showcases must not become production entry chunks');

assert.equal(physics12.simulation.acceptedLegacy[0].gameVersion,'10.0.0');assert.equal(physics12.simulation.acceptedLegacy[0].rules,'legacy-v2');
assert.equal(physics12.visualComparison.rows.length,6);assert(physics12.visualComparison.rows.every(row=>row.decodedPixelsIdentical));
for(const row of physics12.visualComparison.rows){const bytes=readFileSync(join(root,row.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),row.deliverySHA256,'Material comparison must retain its original lossless delivery bytes');assert(read('physics-materials.html').includes(row.url));}
