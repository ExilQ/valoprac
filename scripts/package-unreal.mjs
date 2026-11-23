import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
const path=resolve('public/downloads/valoprac-unreal-source.zip');mkdirSync('public/downloads',{recursive:true});rmSync(path,{force:true});
// Python stdlib produces a portable archive without Unreal's transient build products.
execFileSync('python',['-c',`
import os,zipfile,sys
roots=['unreal','infrastructure/pixel-streaming','docs/migration','src','scripts','patches']
extra=['docs/AIM_SCIENCE.md','public/aim-methodology.html','public/aim-validation.json','docs/FOOTSTEP_CALIBRATION.md','public/footsteps.html','public/footstep-calibration.json','scripts/build-unreal.sh','scripts/export-unreal-data.mjs','scripts/test-unreal-core.mjs','scripts/verify-migration.mjs','scripts/package-unreal.mjs','scripts/compare-latency.mjs','src/config/weapons.ts','src/config/movement.ts','src/engine/rendering/WeaponView.ts','src/engine/audio/synthesis.ts','src/engine/simulation/random.ts','public/streaming-config.json','src/ui/tokens.css','patches/@epicgames-ps__lib-pixelstreamingfrontend-ue5.7@0.3.1.patch','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','THIRD_PARTY_NOTICES.md','README.md','tsconfig.json','vite.config.ts','index.html','public/release.json','public/guide.html','public/migration.html','.openai/hosting.json','.gitignore']
skip={'Binaries','Intermediate','Saved','DerivedDataCache','builds','node_modules','__pycache__'}
with zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_DEFLATED) as z:
 for root in roots:
  for current,dirs,files in os.walk(root):
   dirs[:]=[d for d in dirs if d not in skip]
   for f in sorted(files):z.write(os.path.join(current,f))
 for f in extra:
  if os.path.isfile(f) and f not in z.namelist():z.write(f)
`,path],{stdio:'inherit'});
writeFileSync('public/downloads/README.txt','VALOPRAC UE5.7 staging source. Not an Unreal packaged executable. Read docs/migration/README.md and VALIDATION.md. Actual Unreal build, GPU execution and latency validation are blocked.\n');
console.log('Packaged UE staging source and original assets');
