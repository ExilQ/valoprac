import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveRootPalette,validatePalette} from './verify-interface-palette.mjs';
const css=['src/ui/styles.css','src/ui/tokens.css','src/ui/premium.css','src/ui/precisionUtility.css','src/ui/interfaceRefinement.css'].map(path=>readFileSync(path,'utf8')).join('\n');
test('light palette beats late legacy dark defaults for both tokens and native controls',()=>{
 const palette=resolveRootPalette(css+'\n:root{color-scheme:dark;--bg:#202a2d}', 'light');
 assert.equal(validatePalette(palette,'light').backgroundLuminance,1);
});
test('explicit dark choice keeps its independent palette and readable controls',()=>{
 const report=validatePalette(resolveRootPalette(css,'dark'),'dark');assert(report.backgroundLuminance<.06);
});
test('a light theme that becomes gray is rejected even if text contrast still passes',()=>{
 const palette=resolveRootPalette(css,'light');palette['--bg']='#f2f2f2';
 assert.throws(()=>validatePalette(palette,'light'),/distinctly bright/);
});
test('low contrast control boundaries and placeholder text are rejected',()=>{
 const palette=resolveRootPalette(css,'light');
 assert.throws(()=>validatePalette({...palette,'--control-border':'#dddddd'},'light'),/--control-border/);
 assert.throws(()=>validatePalette({...palette,'--muted':'#cccccc'},'light'),/--muted/);
});
