import { existsSync,mkdirSync,readFileSync,writeFileSync,readdirSync } from 'node:fs';
import {join} from 'node:path';
import {decorate,home,aim,guides,introduction,withIndexingPolicy} from './search-metadata.mjs';
let html=readFileSync('dist-client/index.html','utf8');
html=html.replace(/<div id="root">[\s\S]*?<\/div>/,`<div id="root">${introduction()}</div>`);
html=decorate(html,home);
writeFileSync('dist-client/index.html',html);
// The production static host resolves concrete documents, not Pages rewrite rules.
// Export every client entry route while retaining the same SPA and absolute asset URLs.
const aimIntroduction=`<main data-search-intro class="site-intro"><h1>발로란트 감도 찾기·에임 분석</h1><p>${aim.description}</p><nav aria-label="감도 안내"><a href="/aim-methodology.html">감도 비교·측정 방법 읽기</a><a href="/valorant-aim-trainer.html">에임 연습 소개</a><a href="/">훈련장으로 돌아가기</a></nav><noscript><p>감도 비교 과제에는 자바스크립트가 필요합니다.</p></noscript></main>`;
for(const route of ['training','settings','statistics','results','weapons','unreal','aim','tools','maps']){
 const page=route==='aim'?decorate(html.replace(/<main data-search-intro[\s\S]*?<\/main>/,aimIntroduction),aim):withIndexingPolicy(html,false);
 mkdirSync(`dist-client/${route}`,{recursive:true});
 writeFileSync(`dist-client/${route}/index.html`,page);
 writeFileSync(`dist-client/${route}.html`,page);
}
for(const page of guides){
 const file='dist-client'+page.path;
 let guide=decorate(readFileSync(file,'utf8'),page);
 if(page.path!=='/valorant-aim-trainer.html'){
  const link='<a href="/valorant-aim-trainer.html">에임 연습 소개</a>';
  if(!guide.includes(link))guide=guide.replace('</nav>',link+'</nav>');
  if(!guide.includes('nav{flex-wrap:wrap}'))guide=guide.replace('</style>','nav{flex-wrap:wrap}</style>');
 }
 writeFileSync(file,guide);
}
// Apply the exclusion to every other HTML document, including future additions.
// Plain Google verification files have no head and must retain their exact bytes.
function excludeDocuments(directory){for(const entry of readdirSync(directory,{withFileTypes:true})){
 const file=join(directory,entry.name);
 if(entry.isDirectory())excludeDocuments(file);
 else if(entry.name.endsWith('.html')&&file!=='dist-client/index.html')writeFileSync(file,withIndexingPolicy(readFileSync(file,'utf8'),false));
}}
excludeDocuments('dist-client');

const telemetryPaths = ['index.html','training.html','maps.html','weapons.html','aim.html','statistics.html',
 'settings.html','tools.html','results.html','unreal.html','guide.html','valorant-aim-trainer.html',
 'aim-methodology.html','footsteps.html','tactical-guide.html'];
const beaconToken = process.env.VALOPRAC_CF_WEB_ANALYTICS_TOKEN?.trim();
if (beaconToken && !/^[a-f0-9]{32}$/.test(beaconToken)) throw new Error('Invalid public Cloudflare Web Analytics site token');
const beacon = beaconToken
 ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${beaconToken}"}'></script>`
 : '';
for (const route of telemetryPaths) {
 const variants = route==='index.html' ? [route] : [route,route.replace('.html','/index.html')];
 for (const variant of variants) {
  const file = 'dist-client/'+variant;
  if (!existsSync(file)) continue;
  const document = readFileSync(file,'utf8');
  writeFileSync(file,document.replace('</body>',`<script defer src="/usage.js?v=admission-1"></script>${beacon}</body>`));
 }
}
