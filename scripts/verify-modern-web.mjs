import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const report=json('public/modern-web-validation.json'),release=json('public/release.json');
assert.equal(report.release,release.interface.captureRelease);assert.equal(report.patchLabel,'12.01');assert.equal(report.passed,true);
// The captured browser report is historical; newly added regression tests do not rewrite that evidence.
assert.equal(report.tests.passed,true);assert(json('public/aim-validation.json').tests.application>=report.tests.application);
assert(report.tests.application>=1455);assert.equal(report.tests.broker,20);assert.equal(report.tests.hosting,14);
assert.equal(report.workflow.passed,true);assert.equal(report.workflow.checks.length,15);assert.equal(report.workflow.layouts.length,8);
assert(report.workflow.layouts.every(row=>!row.overflow));assert.equal(report.readability.passed,true);assert.equal(report.readability.failed,0);assert.equal(report.readability.textSamples,2894);
assert(report.gameplay.passed&&report.gameplay.legacyReplayVerified&&report.gameplay.savedReplayVerified);
assert.equal(report.preserved.gameVersion,release.interface.gameplayCompatibilityVersion);assert.equal(report.preserved.gameplayParametersChanged,false);
assert.deepEqual(report.guidance.guides,['accessibility','size-aware-styling','performance','dialog']);assert.equal(report.guidance.cliTelemetryDisabled,true);
const [before,after]=report.initialLoad.rows;assert.equal(before.name,'before');assert.equal(after.name,'after');assert.equal(before.canvas,1);assert.equal(after.canvas,0);assert(after.decoded<before.decoded&&after.gzipEstimate<before.gzipEstimate);
const archivedSources={
 'src/ui/History.tsx':'docs/modern-web-baseline/History.tsx.txt',
 'src/ui/MainMenu.tsx':'docs/modern-web-baseline/MainMenu.tsx.txt',
 'src/ui/Results.tsx':'docs/modern-web-baseline/Results.tsx.txt',
 'src/app/navigation.ts':'docs/modern-web-baseline/navigation.ts.txt',
 'src/ui/TrainingPlatform.tsx':'docs/modern-web-baseline/TrainingPlatform.tsx.txt'
};
for(const [path,expected]of Object.entries(report.sourceSha256)){
 const capturedSource=archivedSources[path]??path;
 assert.equal(createHash('sha256').update(readFileSync(capturedSource)).digest('hex'),expected,`Captured interface source changed: ${path}`);
}
for(const image of report.comparison.images)assert.equal(createHash('sha256').update(readFileSync('public'+image.path)).digest('hex'),image.sha256);
assert.equal(report.limits.hardwareFPSMeasured,false);assert.equal(report.limits.physicalInputLatencyMeasured,false);assert.equal(report.limits.humanUsabilityParticipants,0);
console.log(JSON.stringify({modernWebVerified:true,release:report.release,workflowChecks:15,viewports:8,textSamples:2894,gameplayPreserved:true}));

const review=json('public'+release.interface.webReview);
assert.equal(review.release,'12.0.2');
assert.equal(review.patchLabel,'12.02');
assert.equal(review.passed,true);
assert.equal(review.errors.length,0);
assert.equal(review.viewports.length,42);
assert(review.viewports.every(row=>!row.overflow));
assert(review.touchSizes.every(target=>target.height>=44&&target.width>=44));
assert.equal(review.home.previewCanvases,0);
assert(review.mobileTabs.scroll>0);
console.log(JSON.stringify({webReviewVerified:true,release:review.release,layouts:review.viewports.length}));

const tabReview=json('public'+release.interface.tabReview);
assert.equal(tabReview.release,'12.0.3');
assert.equal(tabReview.passed,true);
assert.equal(tabReview.errors.length,0);
assert(tabReview.checks.length>=5);
assert(tabReview.layouts.length>=12&&tabReview.layouts.every(row=>row.passed));
console.log(JSON.stringify({tabNavigationVerified:true,release:tabReview.release,layouts:tabReview.layouts.length}));
