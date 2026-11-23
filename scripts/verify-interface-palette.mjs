import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const {parse}=createRequire(import.meta.resolve('vite'))('postcss');

// Resolve only unconditional root declarations. This checks shipped CSS, not pixels
// or layout, and deliberately makes no claim about browser visual verification.
export function resolveRootPalette(css,theme){
 const values=new Map();
 parse(css).walkRules(rule=>{
  for(let parent=rule.parent;parent;parent=parent.parent)if(parent.type==='atrule'&&['media','supports','container'].includes(parent.name))return;
  for(const selector of rule.selectors??[]){
   const match=selector.trim().match(/^(:root|html)(?:\[data-theme(?:=["']?(light|dark)["']?)?\])?$/);
   if(!match||match[2]&&match[2]!==theme)continue;
   const specificity=(match[1]===':root'?10:1)+(selector.includes('[data-theme')?10:0);
   for(const declaration of rule.nodes??[]){
    if(declaration.type!=='decl')continue;
    const priority=specificity+(declaration.important?10000:0),previous=values.get(declaration.prop);
    if(!previous||priority>=previous.priority)values.set(declaration.prop,{priority,value:declaration.value});
   }
  }
 });
 return Object.fromEntries([...values].map(([key,{value}])=>[key,value]));
}
export function luminance(hex){
 let value=hex.replace('#','');if(value.length===3)value=[...value].map(c=>c+c).join('');
 assert.match(value,/^[0-9a-f]{6}$/i,`Expected an authored hex color: ${hex}`);
 const channels=[0,2,4].map(i=>parseInt(value.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
 return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
}
export function contrast(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function validatePalette(tokens,theme){
 assert.equal(tokens['color-scheme'],theme,`${theme}: native controls must use the selected theme`);
 const pairs=[];
 const check=(foreground,background,minimum)=>{
  const ratio=contrast(tokens[foreground],tokens[background]);assert(ratio>=minimum,`${theme}: ${foreground} on ${background}: ${ratio.toFixed(2)} < ${minimum}`);
  pairs.push({foreground,background,ratio:+ratio.toFixed(2),minimum});
 };
 for(const background of ['--bg','--surface','--surface-raised','--surface-deep','--accent-soft'])for(const ink of ['--ink','--muted','--subtle'])check(ink,background,4.5);
 check('--on-accent','--accent',4.5);check('--on-accent','--accent-hover',4.5);
 for(const background of ['--surface','--surface-raised']){check('--control-border',background,3);check('--focus',background,3);}
 check('--plot-ink','--plot-bg',4.5);check('--accent','--plot-bg',3);
 if(theme==='light'){
  for(const key of ['--bg','--surface'])assert(luminance(tokens[key])>=.97,`${key} must remain a distinctly bright surface`);
  assert(luminance(tokens['--surface-raised'])>=.9);assert(luminance(tokens['--surface-deep'])>=.85);
 }else assert(luminance(tokens['--bg'])<.06,'Dark mode must retain its independent palette');
 return{theme,background:tokens['--bg'],backgroundLuminance:+luminance(tokens['--bg']).toFixed(3),pairs};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const html=readFileSync('dist-client/index.html','utf8');
 const paths=[...html.matchAll(/<link\b[^>]*href="([^\"]+\.css)"[^>]*>/g)].map(match=>match[1]);assert(paths.length>0);
 const css=paths.map(path=>readFileSync('dist-client'+path,'utf8')).join('\n');
 const themes=['light','dark'].map(theme=>validatePalette(resolveRootPalette(css,theme),theme));
 console.log(JSON.stringify({interfacePaletteVerified:true,method:'bundled-css-root-cascade-and-wcag',themes,browserVisualVerified:false}));
}
