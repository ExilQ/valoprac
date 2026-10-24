import { spawnSync } from 'node:child_process';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'valoprac-core-'));
try{
 const build=spawnSync('g++',['-std=c++20','-O2','-Wall','-Wextra','-Werror','-Iunreal/VALOPRAC/Source/VALOPRAC/Core','unreal/tests/core_probe.cpp','-o',join(dir,'core')],{encoding:'utf8'});if(build.status!==0)throw new Error(build.stderr||'C++ compiler failed');
 for(const fps of [30,60,144,240])for(let id=0;id<3;id++){const r=spawnSync(join(dir,'core'),[String(fps),String(id)],{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);console.log(JSON.stringify({fps,id,...JSON.parse(r.stdout)}));}
}finally{rmSync(dir,{recursive:true,force:true});}
