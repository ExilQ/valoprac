import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
function run(args){const result=spawnSync('npm',args,{encoding:'utf8',maxBuffer:12*1024*1024});process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');if(result.status!==0)process.exit(result.status??1);return (result.stdout??'').replace(/\u001b\[[0-9;?]*[a-zA-Z]/g,'');}
const app=run(['test']),broker=run(['run','test:broker']),hosting=run(['run','test:hosting']);run(['run','verify:migration']);
const summary=[...app.matchAll(/Tests\s+(\d+)\s+passed\s+\((\d+)\)/g)].at(-1);assert(summary&&summary[1]===summary[2],'Test summary must show all passing');
const hostingPass=hosting.match(/(?:#|ℹ)?\s*pass\s+(\d+)/);assert(hostingPass&&/(?:#|ℹ)?\s*fail\s+0/.test(hosting),'Hosting tests must pass');
const brokerPass=broker.match(/(?:#|ℹ)?\s*pass\s+(\d+)/);assert(brokerPass&&/(?:#|ℹ)?\s*fail\s+0/.test(broker),'Broker tests must pass');
function jsonLine(name){for(const line of app.split('\n')){try{const value=JSON.parse(line.trim());if(value.benchmark===name)return value;}catch{}}throw new Error(`Missing executed benchmark: ${name}`);}
const optimizer=jsonLine('synthetic-sensitivity-search'),telemetry=jsonLine('aim-telemetry-cpu');assert.equal(optimizer.humanParticipants,0);assert(optimizer.methods.every(m=>m.observationsPerRun.length===1&&m.observationsPerRun[0]===optimizer.budget));
const visual=existsSync('public/visual-validation.json')?JSON.parse(readFileSync('public/visual-validation.json','utf8')):null;
const report={schema:1,release:JSON.parse(readFileSync('package.json','utf8')).version,patchLabel:'09.00',algorithm:'aim-2.0.0',generatedAt:new Date().toISOString(),tests:{application:+summary[1],broker:+brokerPass[1],hosting:+hostingPass[1],passed:true,renderSchedules:[60,144,240],neutralRuntimeUsesDOMAdapter:true},optimizer,telemetry,humanEvidence:{participants:0,baseline:null,optimized:null,pairedDifference:null,confidenceInterval:null,effectSize:null,sessions:0,conclusion:'inconclusive',humanEffectivenessVerified:false},browserQA:{menusAndSetupVerifiedInChrome:true,browserPointerLock:visual?.browserInput.pointerLockVerified??false,browserFullscreen:visual?.browserInput.fullscreenVerified??false,webgl:visual?.renderer??'unverified',physicalMouseCalibrationVerified:false,publicOriginGameplayVerified:false,highRefreshHardwareVerified:false},unrealPortImplemented:false};
writeFileSync('public/aim-validation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({validationReport:'public/aim-validation.json',applicationTests:report.tests.application,brokerTests:report.tests.broker,humanParticipants:0}));

const lines=app.split('\n').flatMap(line=>{try{return [JSON.parse(line.trim())];}catch{return [];}});
const tactical={schema:1,release:report.release,patchLabel:'09.00',generatedAt:report.generatedAt,tests:report.tests,ads:lines.filter(x=>x.benchmark==='ads-geometry-occlusion'),input:lines.filter(x=>x.benchmark==='input-delivery-cpu'),recovery:lines.find(x=>x.benchmark==='stationary-footstep-recovery'),braking:lines.find(x=>x.benchmark==='braking-comparison'),magazines:lines.find(x=>x.benchmark==='full-magazine-movement'),browserQA:{menuAndPreferenceQA:true,webgl:visual?.renderer??'unverified',softwareScreenshots:!!visual,gpuScreenshots:false,physicalRawInput:false,physicalCtrlW:false,inputToPhoton:false,hardwareFPS:false},unrealPortImplemented:false,calibration:'provisional'};
assert.equal(tactical.ads.length,2);assert.equal(tactical.input.length,4);assert(tactical.recovery&&tactical.braking&&tactical.magazines);
writeFileSync('public/tactical-validation.json',JSON.stringify(tactical,null,2)+'\n');
const footsteps=JSON.parse(readFileSync('public/footstep-calibration.json','utf8'));footsteps.release=report.release;footsteps.calibration='provisional-v3-braking';footsteps.brakingRecovery={model:'actual-resolved-velocity-and-deceleration',provisional:true,documentation:'docs/combat/MOVEMENT_CALIBRATION.md'};footsteps.applicationTests=report.tests.application;footsteps.stationaryRecovery=tactical.recovery;footsteps.brokerTests=report.tests.broker;writeFileSync('public/footstep-calibration.json',JSON.stringify(footsteps,null,2)+'\n');

const peekingGeometry=jsonLine('peeking-geometry');assert.equal(peekingGeometry.passed,true);
const peeking={schema:1,release:report.release,patchLabel:'09.00',generatedAt:report.generatedAt,tests:report.tests,geometry:peekingGeometry,operatorCalibration:JSON.parse(readFileSync('docs/peeking/OPERATOR_CALIBRATION.json','utf8')),nativeParityVerified:false,hardwareFPSVerified:false,physicalInputLatencyVerified:false};
writeFileSync('public/peeking-validation.json',JSON.stringify(peeking,null,2)+'\n');

const surfaces=jsonLine('target-visual-alignment'),surfaceCPU=jsonLine('target-surface-cpu');
const renderedFrames=lines.filter(x=>x.benchmark==='rendered-target-alignment');
assert.equal(surfaces.falsePositive,0);assert.equal(surfaces.falseNegative,0);
assert.deepEqual(renderedFrames.map(x=>x.renderHz),[30,60,144,240]);
for(const frame of renderedFrames){assert.equal(frame.visibleEdgeMisses,0);assert.equal(frame.blankSpaceHits,0);}
const alignmentBaseline=JSON.parse(readFileSync('docs/peeking/HIT_ALIGNMENT_BASELINE.json','utf8'));
const correctness={schema:1,release:report.release,patchLabel:report.patchLabel,generatedAt:report.generatedAt,tests:report.tests,surfaces,surfaceCPU,renderedFrames,alignmentBaseline,comparison:'/hit-alignment.svg',crouchMovingSpreadDegrees:{vandal:.8,phantom:.8,sheriff:.5},limits:{physicalScanoutVerified:false,hardwareFPSVerified:false,physicalInputLatencyVerified:false,allNativeValorantAccuracyConventionsVerified:false}};
writeFileSync('public/correctness-validation.json',JSON.stringify(correctness,null,2)+'\n');

const precisionOptimizer=jsonLine('precision-optimizer-comparison'),precisionCoverage=jsonLine('precision-interval-coverage');
assert.equal(precisionOptimizer.humanParticipants,0);assert.equal(precisionOptimizer.profiles,9);assert.equal(precisionOptimizer.methods.length,4);
for(const result of precisionOptimizer.results){assert.deepEqual(result.observationsPerRun,[result.measurementBudget]);assert.equal(result.runs,precisionOptimizer.seedRuns);}
const precision={schema:1,release:report.release,patchLabel:report.patchLabel,algorithm:'aim-2.0.0',generatedAt:report.generatedAt,tests:report.tests,optimizer:precisionOptimizer,coverage:precisionCoverage,telemetry,humanEvidence:report.humanEvidence,protocols:{quick:{targetMinutes:[5,8],tasks:3,rounds:2},precision:{targetMinutes:[20,40],tasks:7,rounds:3},longitudinal:{minimumSessions:3,minimumDays:2,minimumSpanHours:24},stages:['baseline','coarse','fine','heldout','retention']},storage:{summaries:12000,traces:64,plans:180,profiles:20},limits:{humanImprovementVerified:false,nativeGameTransferVerified:false,physicalSensorCountsVerified:false,physicalInputLatencyVerified:false,universalTaskWeightsVerified:false,GPConfidenceGuarantee:false},methodology:'/aim-methodology.html'};
writeFileSync('public/precision-validation.json',JSON.stringify(precision,null,2)+'\n');

// Captured held-out encounter/browser evidence is kept with its own timestamp
// and source hashes. A build does not relabel it as newly collected hardware data.
const combatEvidence=JSON.parse(readFileSync('docs/combat/BENCHMARK_RESULTS.json','utf8'));
assert.equal(combatEvidence.schema,1);assert(combatEvidence.baseline&&combatEvidence.current&&combatEvidence.protocol&&combatEvidence.limits);
const combatVisual=JSON.parse(readFileSync('docs/combat/BROWSER_QA.json','utf8'));
assert.equal(combatVisual.passed,true);assert(combatVisual.layouts.length>=8);
assert(combatVisual.layouts.every(l=>l.passed&&l.resolutionMatches&&(!l.fullscreen||l.fullscreenEntered)));
for(const size of [[1366,768],[1920,1080],[2560,1440],[3440,1440]])for(const fullscreen of [false,true])assert(combatVisual.layouts.some(l=>l.requested[0]===size[0]&&l.requested[1]===size[1]&&l.fullscreen===fullscreen));
const contrast=JSON.parse(readFileSync('docs/combat/UI_CONTRAST.json','utf8'));assert.equal(contrast.errors.length,0);assert(contrast.contrast.every(p=>p.normalTextAA));
const combat={...combatEvidence,release:report.release,patchLabel:report.patchLabel,generatedAt:report.generatedAt,tests:report.tests,browserQA:combatVisual,contrast,calibration:'combat-movement-penetration-1.0.0-provisional',nativeParityVerified:false,humanFairnessVerified:false,hardwareFPSVerified:false,physicalInputLatencyVerified:false,documentation:'/tactical-guide.html'};
writeFileSync('public/combat-validation.json',JSON.stringify(combat,null,2)+'\n');

// 09.00 movement evidence is freshly measured; previous release visual reports
// above retain their original capture timestamps and are not hardware evidence.
const movementTrajectories=jsonLine('dual-movement-trajectories');
assert.equal(movementTrajectories.renderEquality.length,6);
assert(movementTrajectories.renderEquality.every(x=>x.equal&&x.fixedHz===120));
const movementBrowser=JSON.parse(readFileSync('docs/movement/BROWSER_QA.json','utf8'));
const movementInput=JSON.parse(readFileSync('docs/movement/TRUSTED_INPUT.json','utf8'));
assert.equal(movementBrowser.passed,true);assert.equal(movementBrowser.layouts.length,32);
assert(movementBrowser.layouts.every(x=>x.passed));assert.equal(movementInput.passed,true);
const movementBaseline=JSON.parse(readFileSync('docs/movement/BASELINE_COMPARISON.json','utf8'));
assert.equal(movementBaseline.baselineCommit,'a2d5d97b93d15363b2d182fd775f1bebabfbb0bc');
const movement={schema:1,release:report.release,patchLabel:report.patchLabel,generatedAt:report.generatedAt,calibration:'dual-movement-1.0.0-provisional',tests:report.tests,trajectories:movementTrajectories,baseline:movementBaseline,browserQA:movementBrowser,trustedInput:movementInput,defaultProfile:'valorant',profiles:['valorant','counterStrike/cs2','counterStrike/sourceClassic'],allExistingMaps:true,newMapsOrModes:0,manualJumpsOnly:true,referenceResearch:JSON.parse(readFileSync('docs/movement/REFERENCE_EVIDENCE.json','utf8')),comparison:'/movement-trajectories.svg',documentation:'/tactical-guide.html#movement-09',limits:{nativeParityVerified:false,hardwareFPSVerified:false,physicalInputLatencyVerified:false,nativeCS2SubtickImplemented:false,withinTickOpposedInputAveraged:true}};
writeFileSync('public/movement-validation.json',JSON.stringify(movement,null,2)+'\n');
console.log(JSON.stringify({validationReport:'public/movement-validation.json',layouts:movementBrowser.layouts.length,trustedInputPassed:movementInput.passed,renderSchedules:[60,144,240],nativeParityVerified:false}));
