import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
function run(args){const result=spawnSync('npm',args,{encoding:'utf8',maxBuffer:12*1024*1024});process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');if(result.status!==0)process.exit(result.status??1);return (result.stdout??'').replace(/\u001b\[[0-9;?]*[a-zA-Z]/g,'');}
const packageRelease=JSON.parse(readFileSync('package.json','utf8')),publicRelease=JSON.parse(readFileSync('public/release.json','utf8'));
assert.equal(publicRelease.version,packageRelease.version,'Public and package releases must match before testing');
assert.equal(publicRelease.patchLabel,'12.44');assert.equal(publicRelease.roadmap.replay.simulationVersion,'valoprac-replay-simulation-12');
assert.deepEqual(publicRelease.roadmap.replay.acceptedLegacyVersions,[{gameVersion:'10.0.0',simulationVersion:'valoprac-replay-simulation-2',rules:'legacy-v2'},{gameVersion:'12.0.0',simulationVersion:'valoprac-replay-simulation-3',rules:'materials-v3'},{gameVersion:'12.0.0',simulationVersion:'valoprac-replay-simulation-4',rules:'air-steering-v4'},{gameVersion:'12.0.0',simulationVersion:'valoprac-replay-simulation-5',rules:'bunny-hop-v5'},{gameVersion:'12.0.0',simulationVersion:'valoprac-replay-simulation-6',rules:'weapons-v6'},{gameVersion:'12.0.0',simulationVersion:'valoprac-replay-simulation-7',rules:'training-v7'},{gameVersion:'12.0.0',simulationVersion:'valoprac-replay-simulation-8',rules:'audio-v8'},{gameVersion:'12.0.0',simulationVersion:'valoprac-replay-simulation-9',rules:'consistency-v9'},{gameVersion:'12.0.0',simulationVersion:'valoprac-replay-simulation-10',rules:'acceleration-v10'},{gameVersion:'12.0.0',simulationVersion:'valoprac-replay-simulation-11',rules:'reference-v11'}]);
const app=run(['test']),broker=run(['run','test:broker']),hosting=run(['run','test:hosting']);run(['run','verify:migration']);
const summary=[...app.matchAll(/Tests\s+(\d+)\s+passed\s+\((\d+)\)/g)].at(-1);assert(summary&&summary[1]===summary[2],'Test summary must show all passing');
const hostingPass=hosting.match(/(?:#|ℹ)?\s*pass\s+(\d+)/);assert(hostingPass&&/(?:#|ℹ)?\s*fail\s+0/.test(hosting),'Hosting tests must pass');
const brokerPass=broker.match(/(?:#|ℹ)?\s*pass\s+(\d+)/);assert(brokerPass&&/(?:#|ℹ)?\s*fail\s+0/.test(broker),'Broker tests must pass');
function jsonLine(name){for(const line of app.split('\n')){try{const value=JSON.parse(line.trim());if(value.benchmark===name)return value;}catch{}}throw new Error(`Missing executed benchmark: ${name}`);}
const optimizer=jsonLine('synthetic-sensitivity-search'),telemetry=jsonLine('aim-telemetry-cpu');assert.equal(optimizer.humanParticipants,0);assert(optimizer.methods.every(m=>m.observationsPerRun.length===1&&m.observationsPerRun[0]===optimizer.budget));
const visual=existsSync('public/visual-validation.json')?JSON.parse(readFileSync('public/visual-validation.json','utf8')):null;
const report={schema:1,release:JSON.parse(readFileSync('package.json','utf8')).version,patchLabel:publicRelease.patchLabel,algorithm:'aim-2.0.0',generatedAt:new Date().toISOString(),tests:{application:+summary[1],broker:+brokerPass[1],hosting:+hostingPass[1],passed:true,renderSchedules:[60,144,240],neutralRuntimeUsesDOMAdapter:true},optimizer,telemetry,humanEvidence:{participants:0,baseline:null,optimized:null,pairedDifference:null,confidenceInterval:null,effectSize:null,sessions:0,conclusion:'inconclusive',humanEffectivenessVerified:false},browserQA:{menusAndSetupVerifiedInChrome:true,browserPointerLock:visual?.browserInput.pointerLockVerified??false,browserFullscreen:visual?.browserInput.fullscreenVerified??false,webgl:visual?.renderer??'unverified',physicalMouseCalibrationVerified:false,publicOriginGameplayVerified:false,highRefreshHardwareVerified:false},unrealPortImplemented:false};
writeFileSync('public/aim-validation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({validationReport:'public/aim-validation.json',applicationTests:report.tests.application,brokerTests:report.tests.broker,humanParticipants:0}));

const lines=app.split('\n').flatMap(line=>{try{return [JSON.parse(line.trim())];}catch{return [];}});
const tactical={schema:1,release:report.release,patchLabel:publicRelease.patchLabel,generatedAt:report.generatedAt,tests:report.tests,ads:lines.filter(x=>x.benchmark==='ads-geometry-occlusion'),input:lines.filter(x=>x.benchmark==='input-delivery-cpu'),recovery:lines.find(x=>x.benchmark==='stationary-footstep-recovery'),braking:lines.find(x=>x.benchmark==='braking-comparison'),magazines:lines.find(x=>x.benchmark==='full-magazine-movement'),browserQA:{menuAndPreferenceQA:true,webgl:visual?.renderer??'unverified',softwareScreenshots:!!visual,gpuScreenshots:false,physicalRawInput:false,physicalCtrlW:false,inputToPhoton:false,hardwareFPS:false},unrealPortImplemented:false,calibration:'provisional'};
assert.equal(tactical.ads.length,2);assert.equal(tactical.input.length,4);assert(tactical.recovery&&tactical.braking&&tactical.magazines);
writeFileSync('public/tactical-validation.json',JSON.stringify(tactical,null,2)+'\n');
const footsteps=JSON.parse(readFileSync('public/footstep-calibration.json','utf8'));footsteps.release=report.release;footsteps.calibration='provisional-v3-braking';footsteps.brakingRecovery={model:'actual-resolved-velocity-and-deceleration',provisional:true,documentation:'docs/combat/MOVEMENT_CALIBRATION.md'};footsteps.applicationTests=report.tests.application;footsteps.stationaryRecovery=tactical.recovery;footsteps.brokerTests=report.tests.broker;writeFileSync('public/footstep-calibration.json',JSON.stringify(footsteps,null,2)+'\n');

const peekingGeometry=jsonLine('peeking-geometry');assert.equal(peekingGeometry.passed,true);
const peeking={schema:1,release:report.release,patchLabel:publicRelease.patchLabel,generatedAt:report.generatedAt,tests:report.tests,geometry:peekingGeometry,operatorCalibration:JSON.parse(readFileSync('docs/peeking/OPERATOR_CALIBRATION.json','utf8')),nativeParityVerified:false,hardwareFPSVerified:false,physicalInputLatencyVerified:false};
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
const movement={schema:1,release:report.release,patchLabel:report.patchLabel,generatedAt:report.generatedAt,calibration:'dual-movement-1.4.0-provisional',historicalBrowserCaptureRelease:'9.0.0',tests:report.tests,trajectories:movementTrajectories,baseline:movementBaseline,browserQA:movementBrowser,trustedInput:movementInput,defaultProfile:'valorant',profiles:['valorant','counterStrike/cs2','counterStrike/sourceClassic'],allExistingMaps:true,newMapsOrModes:0,manualJumpsOnly:true,referenceResearch:JSON.parse(readFileSync('docs/movement/REFERENCE_EVIDENCE.json','utf8')),comparison:'/movement-trajectories.svg',documentation:'/tactical-guide.html#movement-09',limits:{nativeParityVerified:false,hardwareFPSVerified:false,physicalInputLatencyVerified:false,nativeCS2SubtickImplemented:false,withinTickOpposedInputAveraged:true}};
writeFileSync('public/movement-validation.json',JSON.stringify(movement,null,2)+'\n');
console.log(JSON.stringify({validationReport:'public/movement-validation.json',layouts:movementBrowser.layouts.length,trustedInputPassed:movementInput.passed,renderSchedules:[60,144,240],nativeParityVerified:false}));

const correctionsBrowser=JSON.parse(readFileSync('docs/0910/BROWSER_QA.json','utf8'));
const correctionsInput=JSON.parse(readFileSync('docs/0910/TRUSTED_INPUT.json','utf8'));
const renderingCorrections=JSON.parse(readFileSync('docs/0910/PERFORMANCE.json','utf8'));
assert.equal(correctionsBrowser.passed,true);assert.equal(correctionsBrowser.layouts.length,40);assert(correctionsBrowser.layouts.every(l=>l.passed&&l.criticalPhysicsVisible));assert(correctionsBrowser.fov.every(f=>f.passed));assert.equal(correctionsInput.passed,true);assert.equal(correctionsInput.audio.passed,true);
const corrections={schema:1,release:report.release,patchLabel:report.patchLabel,generatedAt:report.generatedAt,tests:report.tests,physics:JSON.parse(readFileSync('docs/0910/PHYSICS_BEFORE_AFTER.json','utf8')),botResponse:JSON.parse(readFileSync('docs/0910/BOT_LATENCY_COMPARISON.json','utf8')),audioSpectrum:JSON.parse(readFileSync('docs/0910/AUDIO_SPECTRUM_COMPARISON.json','utf8')),currentSpectrum:jsonLine('original-footstep-spectrum'),rendering:renderingCorrections,browserQA:correctionsBrowser,trustedInput:correctionsInput,documentation:'/tactical-guide.html#corrections-0901',limits:{nativeGameParityVerified:false,nativeSilentJumpVerified:false,hardwareFPSVerified:false,physicalInputLatencyVerified:false,humanListeningTested:false,integratedGPUDetectionHeuristic:true,deliveredCountsAreNotPhysicalSensorCounts:true},scope:{newMaps:false,additionalFeaturePriority:['independent-zoom-sensitivity','rotation-counts','automatic-graphics-guidance']}};
writeFileSync('public/corrections-validation.json',JSON.stringify(corrections,null,2)+'\n');
console.log(JSON.stringify({validationReport:'public/corrections-validation.json',browserLayouts:40,actualScopedFov:correctionsBrowser.fov.map(f=>f.horizontal),nativeSilentJumpVerified:false}));

// Current roadmap measurements are generated by this run. Captured browser and
// physical-device limits retain their own provenance and are never relabeled.
const evidence=name=>JSON.parse(readFileSync(`docs/roadmap/${name}.json`,'utf8'));
const stage1Movement=jsonLine('roadmap-stage1-movement');
for(const row of stage1Movement.rows){assert(Math.abs(row.height-1.15)<=.02);assert(row.airPeak<=row.takeoff.speedCap+1e-8);}
const replayMinute=jsonLine('deterministic-replay-one-minute');
assert(replayMinute.verification.passed&&replayMinute.gzipBytes<=200_000);
const warmup=jsonLine('warmup-real3d-replay'),flash=jsonLine('flash-camera-reaction-replay'),ghost=jsonLine('movement-ghost-shared-replay');
assert(warmup.report.completed&&warmup.replay.passed&&warmup.replay.score>0);
assert(flash.report.completed&&flash.replay.passed&&flash.replay.score===flash.report.score&&flash.report.score>0);
assert(ghost.repeatEqual&&ghost.liveStateUnchanged&&ghost.sourceFinalVerified&&!ghost.independentGhostRecorder);
const scenarioRuns=lines.filter(x=>x.benchmark==='scenario-common-replay');
assert.equal(new Set(scenarioRuns.map(x=>x.route)).size,7);assert.equal(scenarioRuns.length,14);assert(scenarioRuns.every(x=>x.passed&&x.score===1&&x.hits===1));
const stage1UI=evidence('STAGE1_UI_ACCURACY'),stage1HUD=evidence('STAGE1_HUD_LAYOUT'),stage1Audio=evidence('STAGE1_AUDIO_ONSETS');
assert(stage1UI.projection.every(x=>x.passed)&&stage1UI.spread.every(x=>x.passed)&&stage1HUD.passed&&stage1Audio.passed);
const spatial=evidence('STAGE2_AUDIO_SPATIAL'),environment=evidence('STAGE2_ENVIRONMENT'),crosshair=evidence('STAGE2_CROSSHAIR_BROWSER'),rendering=evidence('STAGE2_RENDERING');
assert(spatial.passed&&environment.passed&&crosshair.passed&&rendering.acceptance.drawCalls.passed&&rendering.acceptance.shaderPrograms.passed);
const replayBrowser=evidence('STAGE3_A2_VIEWER_BROWSER'),movementBrowser3=evidence('STAGE3_A3_BROWSER'),scenarioBrowser=evidence('STAGE3_A4_A5_BROWSER'),localeBrowser=evidence('STAGE3_A7_BROWSER'),hudBrowser=evidence('STAGE3_HUD_LAYOUT'),exerciseBrowser=evidence('STAGE3_A1_A6_BROWSER');
assert(replayBrowser.passed&&movementBrowser3.capture.passed&&scenarioBrowser.passed&&localeBrowser.passed&&hudBrowser.passed&&exerciseBrowser.passed);
assert.equal(hudBrowser.layouts.length,40);
const roadmap={schema:1,release:report.release,patchLabel:report.patchLabel,generatedAt:report.generatedAt,tests:report.tests,
 specification:{source:'User-supplied improvement-report text, October29,2026',separatePaginatedPDFInspected:false,identifiers:['F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','I1','I2','I3','I4','I5','I6','I7','I8','I9','A1','A2','A3','A4','A5','A6','A7','A8']},
 baseline:{sourceCommit:'8abf7b173698be249882ab34562016e640df4b3e',applicationTests:940,brokerTests:20,hostingTests:12,initialEncodedBytes:395885,historicalReport380kBAnd861Tests:false},
 gates:{correctnessSoftwarePassed:true,soundAndHardwareSoftwarePassed:true,platformSoftwarePassed:true,fullPhysicalAcceptanceVerified:false,stage4OnlineInfrastructureAdded:false},
 calibration:{classification:'provisional-calibration',nativeGameParityVerified:false,walkingRatio:{issue:'F9',value:.48,changed:false,status:'awaiting-direct-reference-game-measurement'},walkingLanding:{issue:'F10',changed:false,status:'awaiting-direct-reference-game-measurement'},projectionModel:'horizontal-degrees-divided-by-zoom-v1',importantConstantsRetainSourceMetadata:true},
 stage1:{implemented:['F1','F2','F4','F6','F7','F8'],retainedAndVerified:['F3','F5'],movement:stage1Movement,botTiming:evidence('F4_MEASUREMENTS'),projection:stage1UI.projection,spread:stage1UI.spread,audioOnsets:stage1Audio},
 stage2:{implemented:['I1','I2','I3','I4','I5','I6','I7','I8','I9'],spatialPassed:spatial.passed,environmentChecks:environment.checks.length,crosshairChecks:crosshair.checks.length,rendering:rendering.workloads,hardwareAcceptance:rendering.acceptance},
 stage3:{implemented:['A2','A1','A3','A4','A5','A6','A7'],historicalBrowserCaptureRelease:'10.0.0',sharedSimulationVersion:'valoprac-replay-simulation-3',acceptedLegacySimulationVersion:'valoprac-replay-simulation-2',oneMinuteReplay:replayMinute,warmup,flash,ghost,scenarios:scenarioRuns,browser:{replayChecks:replayBrowser.checks.length,movementChecks:movementBrowser3.capture.checks.length,scenarioChecks:scenarioBrowser.checks.length,englishChecks:localeBrowser.checks.length,hudLayouts:hudBrowser.layouts.length,exercise:exerciseBrowser}},
 stage4:{issue:'A8',status:'optional-deferred',reason:'No account or online ranking infrastructure; replay-verifiable local training and manual file/code sharing available.'},
 limits:{nativeVALORANTMeasured:false,physicalIntegratedGPUStartupQualified:false,hardwareFPSVerified:false,physicalInputLatencyVerified:false,headphoneOrLaptopListeningVerified:false,coldStartThreeSecondTargetMetOnSoftwareGPU:false,crossPlatformExactReplayGuarantee:false,replayCompatibility:'Exact game/simulation/config fingerprint only; same-build repeated reconstruction verified.',movementBrowserDrawIsolation:true,unrealRuntimeIntegrated:false},
 privacy:{localFirst:true,accountsRequired:false,trackingAdded:false,externalAssetsAdded:false},documentation:'/tactical-guide.html#roadmap-10',deployment:{verified:false,note:'Build evidence only; publication receipt is recorded separately.'}};
writeFileSync('public/roadmap-validation.json',JSON.stringify(roadmap,null,2)+'\n');
console.log(JSON.stringify({validationReport:'public/roadmap-validation.json',softwareGates:roadmap.gates,applicationTests:report.tests.application,replayBytes:replayMinute.gzipBytes,nativeParityVerified:false}));

// Presentation release evidence is independent of the retained mechanics gate.
const uiEvidence=name=>JSON.parse(readFileSync(`docs/interface-11.00/${name}.json`,'utf8'));
const uiContrast=uiEvidence('COMPUTED_CONTRAST'),uiHUD=uiEvidence('HUD_LAYOUT'),uiFlow=uiEvidence('WORKFLOW'),uiTheme=uiEvidence('THEME_TRANSITION'),uiMain=uiEvidence('MAIN_LAYOUT'),uiDocs=uiEvidence('STATIC_GUIDES'),uiShots=uiEvidence('SCREENSHOTS'),uiKeyboard=uiEvidence('KEYBOARD_MOBILE');
for(const capture of[uiContrast,uiHUD,uiFlow,uiTheme,uiMain,uiDocs,uiKeyboard])assert.equal(capture.passed,true,'Every retained release11 interface capture must pass');
assert.equal(uiKeyboard.checks.length,4);
const uiMainContrast=uiEvidence('MAIN_CONTRAST');assert.equal(uiMainContrast.passed,true);assert.equal(uiMainContrast.failures.length,0);
assert(uiContrast.summary.textRows>=5000&&uiContrast.summary.textFailures===0&&uiContrast.summary.controlFailures===0&&uiContrast.summary.layoutFailures===0);
assert.equal(uiHUD.layouts.length,96);assert(uiFlow.checks.length>=10);assert(uiTheme.frames.length>=20&&uiTheme.pairs.every(p=>p.ratio>=4.5));assert(uiMain.rows.filter(p=>p.version==='after').every(p=>p.aboveFold&&!p.overflow));assert.equal(uiDocs.summary.textFailures,0);assert(uiDocs.summary.documents>=7);assert(uiShots.files.length>=22);
assert.equal(readFileSync('src/ui/tokens.css','utf8'),readFileSync('public/precision-tokens.css','utf8'),'Static guides must use authoritative tokens');
const lowest=(rows,key='contrast')=>Math.min(...rows.filter(x=>x.passed&&Number.isFinite(x[key])).map(x=>x[key]));
const uiReport={schema:1,release:report.release,patchLabel:report.patchLabel,generatedAt:report.generatedAt,captureRelease:'11.0.0',capturePatchLabel:'11.00',captureEvidenceDirectory:'docs/interface-11.00',direction:'Precision Utility',tests:report.tests,
 themes:{default:'light',options:['light','dark','system'],separatePreferenceStorage:true,koreanInterface:true,transitionFrames:uiTheme.frames.length,transitionContrastMinimum:Math.min(...uiTheme.pairs.map(p=>p.ratio))},
 readability:{method:uiContrast.method,steadyState:true,textSamples:uiContrast.summary.textRows,textMinimum:lowest(uiContrast.text.filter(x=>x.threshold===4.5)),svgTextSamples:uiContrast.summary.chartRows,svgTextMinimum:lowest(uiContrast.chartText),formBoundaries:uiContrast.summary.controls,boundaryMinimum:lowest(uiContrast.controls),failedText:0,failedBoundaries:0,sourceCaptureDate:uiContrast.completedAt},
 responsive:{applicationLayouts:uiContrast.layouts.length,hudLayouts:uiHUD.layouts.length,mainLayouts:uiMain.rows.length,staticGuideLayouts:uiDocs.layouts.length,desktopResolutions:[[1280,720],[1366,768],[1600,900],[1920,1080],[2560,1440],[3440,1440]],mobileResolution:[390,844],windowAndFullscreen:true,hudScale:[1,1.25],allPassed:true},
 workflows:{checks:uiFlow.checks,keyboardAndMobile:uiKeyboard.checks,passed:true,graphicsDrawIsolationForInput:true},
 navigation:{beforePrimaryItems:13,afterPrimaryItems:6,settingsCategories:8,startAction:uiMain.rows},
 staticGuides:{...uiDocs.summary,passed:true},
 mainMenuContrast:{textSamples:uiMainContrast.rows.reduce((n,s)=>n+s.text.length,0),bothThemes:true,failures:0,webGLPreviewTextExcluded:true},
 currentSimulation:{gameVersion:'12.0.0',simulationVersion:'valoprac-replay-simulation-12',rules:'braking-v12',materialPhysicsVersion:'physical-surfaces-1.0.0',validation:'/physics-materials-validation.json'},
 preservation:{captureRelease:'11.0.0',scope:'Historical presentation-only release11 evidence; does not describe release12 mechanical changes.',mechanicalCompatibilityVersion:'10.0.0',simulationVersion:'valoprac-replay-simulation-2',engineParametersChanged:false,existingReplayFixtureVerified:true,existingSettingsRetained:true,inputHandlingCoreChanged:false},
 visualComparison:{url:'/interface-comparison.html',baselineSource:'479cebefad88d00670cb5aba98df68232107de8b',captureResolution:[1366,768],originalScreenshots:true,retouched:false,sessionFixture:'Fixed input generated actualSimulation results, not human measurements',hudFixture:'ActualReactHUD and fixedSimulation against bright/dark wall backdrops; noGPU benchmark'},
 limits:{humanUsabilityStudyParticipants:0,physicalInputLatencyMeasured:false,hardwareFPSMeasured:false,softwareGPUResultsAreNotPhysicalGPUQualification:true,nativeVALORANTParityVerified:false,allPossibleUserContentLayoutsGuaranteed:false},
 deployment:{verified:false,note:'Build evidence; final deployment and actual production verification are recorded separately.'}};
writeFileSync('public/interface-validation.json',JSON.stringify(uiReport,null,2)+'\n');
console.log(JSON.stringify({validationReport:'public/interface-validation.json',textSamples:uiContrast.summary.textRows,hudLayouts:96,applicationTests:report.tests.application,physicalLatencyMeasured:false}));

// Release12 captures are explicitly separate from historical UI/roadmap evidence.
const physicsEvidence=name=>JSON.parse(readFileSync(`docs/physics-materials/${name}.json`,'utf8'));
const collision12=physicsEvidence('COLLISION_RESULTS'),queries12=physicsEvidence('QUERY_BENCHMARK'),step12=physicsEvidence('STEP_PROFILE'),wasm12=physicsEvidence('WASM_EVALUATION'),release12=physicsEvidence('RELEASE_VALIDATION');
assert.equal(release12.release,'12.0.0');assert.equal(release12.patchLabel,'12.00'); // Retain original mechanical capture metadata for presentation-only patches.
assert.equal(collision12.validation.passed,true);assert.equal(collision12.fixedHz,120);
assert.equal(queries12.parity.mismatches,0);assert.equal(wasm12.parity.mismatches,0);
assert(release12.gates.completed,'Release12 rendering, lifecycle and browser evidence must be finalized before packaging');
assert(release12.gates.renderingSourceUnchanged&&release12.gates.shaderPreparationPassed&&release12.gates.lifecyclePassed&&release12.gates.browserPassed,'Release12 measured software gates must pass');
assert.equal(release12.baseline.commit,'0029c162de2756aa11092748514efe726e1ee217');
assert.equal(release12.rendering?.passed,true);assert.equal(release12.rendering?.sourceUnchanged,true);
assert.equal(release12.shaderPreparation?.passed,true);assert.equal(release12.browser?.passed,true);
assert.equal(release12.lifecycle?.longSessionPassed,true);assert.equal(release12.lifecycle?.browserResourceCycles?.passed,true);
const materialComparison=physicsEvidence('VISUAL_DELIVERY');assert.equal(materialComparison.rows.length,6);assert(materialComparison.rows.every(row=>row.decodedPixelsIdentical));
const physics12={schema:1,release:report.release,patchLabel:report.patchLabel,generatedAt:report.generatedAt,tests:report.tests,
 simulation:{gameVersion:'12.0.0',version:'valoprac-replay-simulation-12',rules:'braking-v12',fixedHz:120,movementVersion:'dual-movement-1.4.0',materialPhysicsVersion:'physical-surfaces-1.0.0',weaponVersion:'weapons-10.0.0',acceptedLegacy:publicRelease.roadmap.replay.acceptedLegacyVersions},
 measuredReleaseEvidence:release12,collision:collision12,visualComparison:{...materialComparison,url:'/physics-materials.html'},
 queries:{captureDate:queries12.date,baseline:queries12.baseline.commit,runtime:queries12.runtime,method:queries12.method,parity:queries12.parity,maps:queries12.maps.map(m=>({map:m.map,obstacles:m.obstacles,geometrySha256:m.geometrySha256,currentVision:m.currentVision,candidates:m.candidates,timing:m.timing})),documentation:'docs/physics-materials/QUERY_BENCHMARK.json'},
 simulationProfile:{captureDate:step12.date,runtime:step12.runtime,method:step12.method,limits:step12.limits,documentation:'docs/physics-materials/STEP_PROFILE.json'},
 wasm:{captureDate:wasm12.date,decision:wasm12.decision,runtime:wasm12.runtime,parity:wasm12.parity,timing:wasm12.timing,productionAdopted:false,rustMeasured:false},
 surfaces:{physicalIds:22,visualFamilies:15,allContactFrictionMultipliers:1,physicalPropertiesIndependentFromPBR:true,calibration:'provisional'},
 preserved:{fixedSimulation:true,dualProfiles:true,threeProfilesIncludingSourceClassic:true,footstepAccumulation:true,allWeapons:true,allExistingModes:true,koreanInterface:true,strictCSP:true,trackingAdded:false},
 limits:{nativeGameParityVerified:false,directWalkingRatioMeasurement:false,directSilentLandingMeasurement:false,hardwareIntegratedGPUQualified:false,hardwareFPSVerified:false,physicalInputLatencyVerified:false,humanListeningTested:false,fullRustOrWASMEngineBenchmarked:false},
 documentation:'/physics-materials.html',deployment:{verified:false,note:'Build evidence only; actual publication receipt is maintained separately.'}};
writeFileSync('public/physics-materials-validation.json',JSON.stringify(physics12,null,2)+'\n');
console.log(JSON.stringify({validationReport:'public/physics-materials-validation.json',applicationTests:report.tests.application,queryMismatches:queries12.parity.mismatches,softwareGatesPassed:release12.gates.completed,physicalGPUQualified:false}));
